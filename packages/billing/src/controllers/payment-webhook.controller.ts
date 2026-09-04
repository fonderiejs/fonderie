import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { SubscriberType } from '../types';
import { WalletModel } from '../models/wallet.model';
import { DuplicateTransactionError } from '../errors';

// One-time payment webhook — a SEPARATE endpoint (and secret) from the
// subscription webhook, so each provider endpoint carries one event family.
// Idempotency: the ledger key `<provider>:checkout:<sessionId>` makes event
// replays no-ops.

export function paymentWebhookController(store: IStoreAdapter, config: IBillingConfig) {
	const wallet = new WalletModel(store);

	return {
		async handle(ctx: IFonderieContext): Promise<Response> {
			// Deliberately NOT falling back to the subscription webhook's secret:
			// per-endpoint secrets exist so a delivery captured for one endpoint
			// can never replay validly against the other.
			const secret = config.wallet?.webhookSecret;
			if (!secret) {
				return setApiResponse(
					HTTP.SERVER_ERROR,
					'SERVER_ERROR',
					'Payment webhook secret not configured — set wallet.webhookSecret',
				);
			}

			const signature =
				ctx.request.headers.get('stripe-signature') ??
				ctx.request.headers.get('paypal-auth-algo') ??
				'';
			if (!signature) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Missing webhook signature');
			}

			const payload = await ctx.request.text();
			let event: Awaited<ReturnType<typeof config.provider.constructEvent>>;
			try {
				event = await config.provider.constructEvent({ payload, signature, secret });
			} catch {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Invalid webhook signature');
			}

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

			const currency = meta['currency'] ?? config.wallet?.currency ?? 'USD';
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
