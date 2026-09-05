import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { SubscriberType } from '../types';
import type { INormalizedPaymentFailure, INormalizedReversal } from '../providers/types';
import { WalletModel } from '../models/wallet.model';
import { DuplicateTransactionError } from '../errors';
import { normalizeCurrency, subscriberEventFields } from '../utils';
import { notifyBilling } from '../services/notify';
import { upsertWalletCustomer } from '../services/wallet-customers';
import { readWebhookEvent } from './webhook-shared';

// A ledger-stored money amount (JSON metadata) parsed back to bigint, or null
// when absent/malformed — so a missing amountPaid degrades to "no proration".
function toBigIntOrNull(v: unknown): bigint | null {
	if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
	if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
	return null;
}

// One-time payment webhook — a SEPARATE endpoint (and secret) from the
// subscription webhook, so each provider endpoint carries one event family.
// Idempotency: the ledger key `<provider>:checkout:<sessionId>` makes event
// replays no-ops.

export function paymentWebhookController(store: IStoreAdapter, config: IBillingConfig, bus?: EventBus) {
	const wallet = new WalletModel(store);

	// Refund / chargeback → claw back the credits the original purchase granted.
	// Closes the §C value-leak (buy → spend → refund the card → keep the goods).
	// The reversal event carries no wallet metadata, so we join back to the
	// purchase by its PaymentIntent (provider_tx_id) and reverse a proportional
	// share of the granted credits — allowed to drive the balance negative.
	async function handleReversal(reversal: INormalizedReversal): Promise<Response> {
		const pi = reversal.providerTxId;
		// Cannot join back to a purchase → acknowledge and leave the wallet
		// alone. Never guess a subscriber to debit; the provider dashboard still
		// records the refund, this only means we have nothing of ours to reverse.
		if (!pi) return Response.json({ received: true, ignored: 'no-provider-tx-id' });
		const purchase = await wallet.findPurchase(pi);
		if (!purchase) return Response.json({ received: true, ignored: 'no-matching-purchase' });

		const sub = {
			subscriberType: purchase.subscriberType,
			subscriberId: purchase.subscriberId,
			currency: purchase.currency,
		};
		const packId = typeof purchase.metadata['packId'] === 'string' ? purchase.metadata['packId'] : null;

		// Dispute WON: funds were returned, so restore exactly what this
		// dispute's chargeback clawed (if anything). Distinct idempotency key.
		if (reversal.kind === 'dispute' && reversal.status === 'won') {
			const clawKey = `${config.provider.name}:dispute:${reversal.id}`;
			const clawed = await wallet.ledgerAmountByKey(clawKey); // negative, or null
			if (clawed === null || clawed >= 0n) return Response.json({ received: true });
			const result = await wallet.credit({
				...sub,
				amount: -clawed,
				type: 'refund',
				idempotencyKey: `${clawKey}:won`,
				providerTxId: pi,
				description: `Dispute ${reversal.id} won — credits restored`,
				metadata: { disputeId: reversal.id, providerTxId: pi, ...(packId ? { packId } : {}) },
			});
			if (!result.duplicate) {
				bus
					?.emit(EVENT_KEYS.walletCredited, {
						...subscriberEventFields(sub.subscriberType, sub.subscriberId),
						currency: sub.currency,
						credits: (-clawed).toString(),
						balanceAfter: result.balance.toString(),
						...(packId ? { packId } : {}),
						source: 'dispute-won',
					})
					.catch(() => {});
			}
			return Response.json({ received: true, duplicate: result.duplicate });
		}

		// Clawback (refund, dispute opened, or dispute lost). Decide the credits
		// to reverse; reverseWallet enforces the cumulative cap (never reverse
		// more than was granted for this charge) INSIDE its transaction under a
		// per-charge lock, so concurrent reversals can't over-reverse.
		const amountPaid = toBigIntOrNull(purchase.metadata['amountPaid']);
		let requested: bigint;
		if (reversal.amount == null) {
			// No amount ⇒ full reversal (the cap clamps to what remains).
			requested = purchase.credits;
		} else if (amountPaid != null && amountPaid > 0n) {
			// Prorate granted credits to the reversed money (both in the payment
			// currency's smallest unit); bigint division floors, so we never
			// over-reverse on rounding.
			requested = (purchase.credits * reversal.amount) / amountPaid;
		} else {
			// A known partial amount with no basis to prorate — refuse to guess
			// rather than claw the whole balance for a partial refund.
			return Response.json({ received: true, reversed: '0', ignored: 'no-proration-basis' });
		}
		if (requested <= 0n) return Response.json({ received: true, reversed: '0' });

		// Key off the reversal's OWN id — a charge can be partially refunded many
		// times, each a distinct reversal. dispute.closed 'lost' reuses the
		// dispute-created key and no-ops (the funds already left on creation).
		const result = await wallet.reverse({
			...sub,
			amount: requested,
			capToProviderTxId: purchase.credits,
			idempotencyKey: `${config.provider.name}:${reversal.kind}:${reversal.id}`,
			providerTxId: pi,
			description: `Reversal (${reversal.kind}) ${reversal.id}`,
			metadata: {
				kind: reversal.kind,
				reversalId: reversal.id,
				providerTxId: pi,
				refundAmount: reversal.amount?.toString() ?? null,
				refundCurrency: reversal.currency,
				...(packId ? { packId } : {}),
				...(reversal.reason ? { reason: reversal.reason } : {}),
			},
		});

		// Publish + notify only on a real, non-empty reversal (not a replay and
		// not a fully-capped no-op), mirroring the purchase path so a re-delivered
		// refund never double-fires.
		if (!result.duplicate && result.reversed > 0n) {
			const fields = {
				...subscriberEventFields(sub.subscriberType, sub.subscriberId),
				currency: sub.currency,
				credits: result.reversed.toString(),
				balanceAfter: result.balance.toString(),
				kind: reversal.kind,
				...(packId ? { packId } : {}),
				providerTxId: pi,
			};
			bus?.emit(EVENT_KEYS.paymentRefunded, fields).catch(() => {});
			bus?.emit(EVENT_KEYS.walletDebited, { ...fields, source: 'refund' }).catch(() => {});
			void notifyBilling(bus, config, {
				subscriberType: sub.subscriberType,
				subscriberId: sub.subscriberId,
				type: MESSAGE_KEYS.refundProcessed,
				data: {
					...(packId ? { packId } : {}),
					credits: result.reversed.toString(),
					currency: sub.currency,
					balanceAfter: result.balance.toString(),
					kind: reversal.kind,
					refundAmount: reversal.amount?.toString() ?? null,
					refundCurrency: reversal.currency,
				},
			});
		}
		return Response.json({
			received: true,
			duplicate: result.duplicate,
			reversed: result.reversed.toString(),
		});
	}

	// A failed one-time payment ATTEMPT (delayed-method pack payment, or a
	// declined PaymentIntent). Notification/record only — no money moved, so
	// nothing to reverse. Only our wallet-checkout failures carry the subscriber
	// identity in metadata; an unattributable bare PI failure is acked + ignored.
	async function handlePaymentFailure(failure: INormalizedPaymentFailure): Promise<Response> {
		const meta = failure.metadata;
		// An auto-recharge off-session decline is already owned by
		// maybeAutoRecharge (it emits auto_recharge.failed + its own notice, and
		// backs off/disables). Its PaymentIntent carries our subscriber metadata,
		// so without this guard the provider's payment_intent.payment_failed for
		// the same charge would send a SECOND email + a mislabeled payment.failed.
		if (meta['reason'] === 'auto-recharge') {
			return Response.json({ received: true, ignored: 'auto-recharge-handled-elsewhere' });
		}
		const subscriberType = meta['subscriberType'];
		const subscriberId = meta['subscriberId'];
		if ((subscriberType !== 'user' && subscriberType !== 'workspace') || !subscriberId) {
			return Response.json({ received: true, ignored: 'unattributable-payment-failure' });
		}
		const packId = typeof meta['packId'] === 'string' ? meta['packId'] : null;
		const fields = {
			...subscriberEventFields(subscriberType as SubscriberType, subscriberId),
			...(packId ? { packId } : {}),
			amount: failure.amount?.toString() ?? null,
			currency: failure.currency,
			reason: failure.reason,
			...(failure.providerTxId ? { providerTxId: failure.providerTxId } : {}),
		};
		bus?.emit(EVENT_KEYS.paymentFailed, fields).catch(() => {});
		void notifyBilling(bus, config, {
			subscriberType: subscriberType as SubscriberType,
			subscriberId,
			type: MESSAGE_KEYS.paymentFailed,
			data: {
				...(packId ? { packId } : {}),
				amount: failure.amount?.toString() ?? null,
				currency: failure.currency,
				reason: failure.reason,
			},
		});
		return Response.json({ received: true });
	}

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

			// Refund/chargeback events carry no event.payment and would otherwise
			// die at the `if (!payment)` guard below — dispatch them first.
			if (event.reversal) return handleReversal(event.reversal);
			if (event.paymentFailure) return handlePaymentFailure(event.paymentFailure);

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

					// Customer-facing receipt (§ Communication & Record Integrity).
					// Same guard as the domain events — only on a real credit, so
					// a webhook replay never double-sends. Fire-and-forget inside
					// notifyBilling; a resolver/courier error can't fail the credit.
					void notifyBilling(bus, config, {
						subscriberType: subscriberType as SubscriberType,
						subscriberId,
						type: MESSAGE_KEYS.paymentReceipt,
						data: {
							packId,
							credits,
							currency,
							balanceAfter: result.balance.toString(),
							amountPaid: payment.amountTotal?.toString() ?? null,
							paymentCurrency: payment.currency,
							...(payment.providerTxId ? { providerTxId: payment.providerTxId } : {}),
						},
					});
				}

				// Persist the customer that holds the saved card so a later
				// off-session auto-recharge can charge it (re-arming auto-recharge
				// on this fresh purchase). Runs on every paid delivery (idempotent
				// upsert) so a retry that skipped the emit block still records it;
				// wrapped so a persistence hiccup can never fail a webhook whose
				// credit already committed.
				if (payment.customerId) {
					try {
						// Resolve the exact card this purchase used, so a later
							// off-session auto-recharge charges the consented card (not
							// merely the newest one). Only on a fresh purchase, and only
							// when the provider can resolve it.
							let paymentMethodId: string | null = null;
							if (!result.duplicate && payment.providerTxId && config.provider.getPaymentMethodForIntent) {
								paymentMethodId = await config.provider.getPaymentMethodForIntent(payment.providerTxId);
							}
							await upsertWalletCustomer(
								{
									subscriberType: subscriberType as SubscriberType,
									subscriberId,
									provider: config.provider.name,
									providerCustomerId: payment.customerId,
									// Re-arm auto-recharge (clear disable + failures) only on a
									// genuinely NEW purchase — a replayed delivery of an old
									// purchase must not resurrect a card that failures disabled.
									rearm: !result.duplicate,
									...(paymentMethodId ? { paymentMethodId } : {}),
								},
								store,
							);
					} catch {
						// best-effort; auto-recharge stays un-armed until the next
						// successful purchase persists the customer.
					}
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
