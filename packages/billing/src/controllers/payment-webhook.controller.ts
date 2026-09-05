import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS } from '../config';
import type { SubscriberType } from '../types';
import { WalletModel } from '../models/wallet.model';
import { DuplicateTransactionError } from '../errors';
import { normalizeCurrency, subscriberEventFields } from '../utils';
import { readWebhookEvent } from './webhook-shared';

// One-time payment webhook — a SEPARATE endpoint (and secret) from the
// subscription webhook, so each provider endpoint carries one event family.
// Idempotency: the ledger key `<provider>:checkout:<sessionId>` makes event
// replays no-ops.

export function paymentWebhookController(store: IStoreAdapter, config: IBillingConfig, bus?: EventBus) {
	const wallet = new WalletModel(store);

	return {
		async handle(ctx: IFonderieContext): Promise<Response> {
			// Deliberately NOT falling back to the subscription webhook's secret:
			// per-endpoint secrets exist so a delivery captured for one endpoint
			// can never replay validly against the other.
			const event = await readWebhookEvent(
				ctx,
				config.wallet?.webhookSecret,
				config.provider,
				'Payment webhook secret not configured — set wallet.webhookSecret',
			);
			if (event instanceof Response) return event;

			const payment = event.payment;
			// Not a completed one-time payment (subscription events and other
			// noise arrive here when the operator points one endpoint at both).
			if (!payment) return Response.json({ received: true });

			const meta = payment.metadata;
			// Only sessions created by the wallet checkout carry a packId; other
			// one-time payments through the same account are not ours to credit.
			const packId = meta['packId'];
			if (!packId) return Response.json({ received: true });

			const subscriberType = meta['subscriberType'];
			const subscriberId = meta['subscriberId'];
			const credits = meta['credits'] ?? '';
			if (
				(subscriberType !== 'user' && subscriberType !== 'workspace') ||
				!subscriberId ||
				!/^\d{1,30}$/.test(credits)
			) {
				// Ours (packId present) but broken — surface as a webhook failure
				// so the provider dashboard flags it instead of silently dropping.
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'Malformed wallet checkout metadata',
				);
			}

			// Only credit once funds are confirmed. Delayed-notification methods
			// (ACH/SEPA debit, vouchers…) complete checkout with an unpaid
			// status; the provider sends a paid follow-up event later (e.g.
			// checkout.session.async_payment_succeeded) which lands here again.
			const status = payment.paymentStatus ?? null;
			if (status !== null && status !== 'paid' && status !== 'no_payment_required') {
				return Response.json({ received: true, pending: true });
			}

			const currency = normalizeCurrency(meta['currency'] ?? config.wallet?.currency ?? 'USD');
			try {
				const result = await wallet.credit({
					subscriberType: subscriberType as SubscriberType,
					subscriberId,
					currency,
					amount: BigInt(credits),
					type: 'purchase',
					idempotencyKey: `${config.provider.name}:checkout:${payment.sessionId}`,
					description: `Credit pack ${packId}`,
					metadata: {
						packId,
						amountPaid: payment.amountTotal?.toString() ?? null,
						paymentCurrency: payment.currency,
					},
					...(payment.providerTxId ? { providerTxId: payment.providerTxId } : {}),
				});

				// Publish only on a real credit — a webhook replay returns
				// duplicate:true and must not re-emit (which would double-send a
				// receipt / re-fire downstream automation). bigints go out as
				// strings (payloads are JSON — persisted and forwarded).
				if (!result.duplicate) {
					const fields = {
						...subscriberEventFields(subscriberType as SubscriberType, subscriberId),
						currency,
						credits,
						balanceAfter: result.balance.toString(),
						packId,
						...(payment.providerTxId ? { providerTxId: payment.providerTxId } : {}),
					};
					bus?.emit(EVENT_KEYS.creditPackPurchased, fields).catch(() => {});
					bus
						?.emit(EVENT_KEYS.walletCredited, { ...fields, source: 'purchase' })
						.catch(() => {});
				}

				return Response.json({ received: true, duplicate: result.duplicate });
			} catch (err) {
				if (err instanceof DuplicateTransactionError) {
					return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_TRANSACTION', err.message);
				}
				throw err;
			}
		},
	};
}
