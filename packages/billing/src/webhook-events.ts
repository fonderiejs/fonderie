/**
 * The provider events this package consumes, declared once.
 *
 * Until now this list existed only as a scatter of `if (raw.type === …)`
 * branches inside the normalizer. Anyone configuring a provider endpoint — or
 * writing a runbook — had to read that source and transcribe it, and a
 * transcription can drift from the code without anything failing.
 *
 * Drift here is not cosmetic. The two directions fail very differently:
 *
 *   - REGISTERED BUT NOT HANDLED is loud and harmless: the event arrives, no
 *     branch matches, the webhook returns 200 and nothing happens.
 *   - HANDLED BUT NOT REGISTERED is SILENT and expensive. The code has a
 *     handler, the provider was never told to send it, so the event simply
 *     never arrives. Dunning emails are never sent, cancellations never
 *     processed, wallets never credited — and no log line is emitted, because
 *     nothing happened. An absent event is indistinguishable from one that has
 *     not occurred yet, so this cannot be detected by watching traffic.
 *
 * Only comparing what the provider is configured to send against this list
 * catches the second kind. `checkWebhookRegistration()` does exactly that.
 */

/** Subscription lifecycle → POST /billing/webhook */
export const SUBSCRIPTION_LIFECYCLE_EVENTS = [
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	// Carries the subscription; emits a heads-up notice without mutating state.
	'customer.subscription.trial_will_end',
] as const;

/** Subscription invoices (renewal receipts + dunning) → POST /billing/webhook */
export const SUBSCRIPTION_INVOICE_EVENTS = ['invoice.paid', 'invoice.payment_failed'] as const;

/** Everything POST /billing/webhook must be configured to receive. */
export const SUBSCRIPTION_WEBHOOK_EVENTS = [
	...SUBSCRIPTION_LIFECYCLE_EVENTS,
	...SUBSCRIPTION_INVOICE_EVENTS,
] as const;

/** Wallet / credit-pack payments → POST /billing/webhook/payment */
export const PAYMENT_WEBHOOK_EVENTS = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'checkout.session.async_payment_failed',
	'payment_intent.succeeded',
	'payment_intent.payment_failed',
	// Reversals — clawing back credits the buyer no longer paid for.
	'charge.refunded',
	'charge.dispute.created',
	'charge.dispute.closed',
] as const;

export type SubscriptionWebhookEvent = (typeof SUBSCRIPTION_WEBHOOK_EVENTS)[number];
export type PaymentWebhookEvent = (typeof PAYMENT_WEBHOOK_EVENTS)[number];
export type ConsumedWebhookEvent = SubscriptionWebhookEvent | PaymentWebhookEvent;

/** Every event either endpoint consumes. */
export const ALL_WEBHOOK_EVENTS: readonly ConsumedWebhookEvent[] = [
	...SUBSCRIPTION_WEBHOOK_EVENTS,
	...PAYMENT_WEBHOOK_EVENTS,
];

/**
 * Whether this package does anything at all with an event type.
 *
 * Used to warn when a provider sends something unrecognised — normally because
 * an event was ticked on the endpoint that no handler consumes, or because the
 * provider introduced a new type. Neither breaks anything, but both mean the
 * endpoint's configuration and this package disagree, and that is worth saying
 * out loud exactly once rather than discovering later.
 */
export function isConsumedWebhookEvent(type: string): type is ConsumedWebhookEvent {
	return (ALL_WEBHOOK_EVENTS as readonly string[]).includes(type);
}
