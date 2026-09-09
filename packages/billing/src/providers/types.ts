import type { BillingInterval, SubscriberType } from '../types';

// The normalized event shape — provider-agnostic
export interface IBillingEvent {
	type: string;
	// When the provider emitted this event (provider clock). Used to order
	// at-least-once, unordered subscription webhooks: the subscription upsert
	// no-ops any event older than the one already applied. Optional/nullable —
	// only set by providers that expose an event timestamp (Stripe's
	// `event.created`); a null leaves the row's ordering guard permissive.
	eventAt?: Date | null;
	subscription: INormalizedSubscription | null;
	// One-time payment completion (credit pack purchase). Only set by providers
	// that support one-time payments — optional so existing custom providers
	// stay source-compatible.
	payment?: INormalizedPayment | null;
	// A refund or chargeback reversing a prior one-time payment. Optional and
	// nullable for the same source-compatibility reason as `payment`; only
	// providers that normalize refund/dispute events set it.
	reversal?: INormalizedReversal | null;
	// A subscription invoice that was paid or failed (renewal receipt / dunning).
	// Optional/nullable — only providers that normalize invoice events set it.
	invoice?: INormalizedInvoice | null;
	// A one-time payment ATTEMPT that failed (a delayed-method pack payment, or a
	// declined PaymentIntent). Distinct from `payment` (a completion) and from a
	// subscription's past_due dunning. Optional/nullable.
	paymentFailure?: INormalizedPaymentFailure | null;
}

// A subscription invoice event — a successful renewal (status 'paid') or a
// failed renewal payment (status 'payment_failed'). Notification/record only;
// no wallet effect.
export interface INormalizedInvoice {
	id: string;
	status: 'paid' | 'payment_failed';
	amount: bigint | null; // amount_paid (paid) or amount_due (failed), smallest unit
	currency: string | null;
	providerTxId: string | null; // the invoice's PaymentIntent
	providerSubscriptionId: string | null; // correlates to the stored subscription
	providerCustomerId: string | null;
	metadata: Record<string, string>;
}

// A failed one-time payment ATTEMPT (checkout.session.async_payment_failed or a
// declined payment_intent). `sessionId` is present for the checkout variant and
// null for a bare PaymentIntent. Notification/record only.
export interface INormalizedPaymentFailure {
	sessionId: string | null;
	providerTxId: string | null; // the PaymentIntent
	amount: bigint | null;
	currency: string | null;
	reason: string | null; // decline code / last_payment_error message where available
	metadata: Record<string, string>;
}

// A refund or chargeback that reverses a prior one-time payment (credit-pack
// purchase). The wallet uses this to claw back the credits that purchase
// granted (the §C value-leak: buy → spend → refund the card → keep the goods).
export interface INormalizedReversal {
	// 'refund' — the merchant/customer refunded the charge. 'dispute' — a
	// chargeback: funds are withdrawn on creation and returned only if won.
	kind: 'refund' | 'dispute';
	// The refund's or dispute's OWN provider id (Stripe re_… / dp_…). This is
	// the idempotency anchor: a charge can be partially refunded many times,
	// each a distinct id, so the reversal must key off this, never the charge.
	id: string;
	// The reversed PaymentIntent — the join key back to the wallet credit this
	// reverses (the purchase ledger row stored it as provider_tx_id).
	providerTxId: string | null;
	chargeId: string | null;
	// Amount reversed by THIS event, in the payment currency's smallest unit.
	// Compared against the original amount paid to prorate the credit clawback.
	amount: bigint | null;
	currency: string | null;
	reason: string | null;
	// Dispute lifecycle status ('needs_response' | 'won' | 'lost' | …); a 'won'
	// closure returns the funds, so the clawback is reversed. null for a refund.
	status: string | null;
	metadata: Record<string, string>;
}

// A completed one-time payment, normalized from the provider's checkout event.
export interface INormalizedPayment {
	sessionId: string;
	providerTxId: string | null; // e.g. the Stripe PaymentIntent id
	// The provider customer this payment belongs to — persisted so a later
	// off-session auto-recharge can charge the card saved on that customer.
	// null when the checkout was not tied to a stored customer.
	customerId: string | null;
	amountTotal: bigint | null; // what the customer paid, smallest currency unit
	currency: string | null;
	// 'paid' / 'no_payment_required' when funds are confirmed; other values
	// (e.g. Stripe's 'unpaid' for delayed-notification methods) mean the money
	// has NOT moved yet. null when the provider doesn't model it.
	paymentStatus: string | null;
	metadata: Record<string, string>;
}

export interface INormalizedSubscription {
	subscriberType: SubscriberType;
	subscriberId: string;
	/** Plan name from the price nickname (legacy fallback; prefer resolving via priceLookupKey/priceId). */
	plan: string;
	/** The subscription item's price lookup_key + id — for config-based plan attribution (§16.3). */
	priceLookupKey: string | null;
	priceId: string | null;
	status: string;
	providerCustomerId: string;
	providerSubscriptionId: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: Date | null;
	interval: BillingInterval;
}

// The result of a cancel / reactivate — the resulting subscription state, used
// to optimistically update the stored row (the webhook later confirms it).
export interface ISubscriptionChange {
	status: string;
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date | null;
}

// Live price resolved from the provider (Stripe = source of truth).
export interface IResolvedPrice {
	priceId: string;
	lookupKey: string | null;
	unitAmount: bigint; // smallest currency unit
	currency: string; // ISO 4217 (Stripe lowercases)
	interval: BillingInterval;
	nickname: string | null;
	productId: string;
	active: boolean;
}

// The one interface every handler calls
// The customer's card on file, for display only — never the full number.
export interface INormalizedCard {
	brand: string; // 'visa' | 'mastercard' | 'amex' | …
	last4: string;
	expMonth: number;
	expYear: number;
}

// One invoice as a list summary, for an in-app billing history that links out
// to the provider-hosted invoice. Amounts are in the smallest currency unit.
export interface INormalizedInvoiceSummary {
	id: string;
	number: string | null;
	amountDue: bigint;
	amountPaid: bigint;
	currency: string;
	status: string; // 'paid' | 'open' | 'draft' | 'void' | 'uncollectible' | …
	created: string; // ISO-8601
	dueDate: string | null; // ISO-8601 when the invoice has payment terms; null otherwise (paid-on-charge)
	hostedInvoiceUrl: string | null;
	invoicePdf: string | null;
}

export interface IBillingProvider {
	name: string;

	// Create or retrieve a customer record with the provider
	createCustomer(opts: {
		email: string;
		subscriberType: SubscriberType;
		subscriberId: string;
		userId: string;
	}): Promise<{ customerId: string }>;

	// Generate a hosted checkout URL
	createCheckoutSession(opts: {
		customerId: string;
		priceId: string;
		subscriberType: SubscriberType;
		subscriberId: string;
		trialDays?: number;
		successUrl: string;
		cancelUrl: string;
		// Client-supplied idempotency key: retries dedupe to one session.
		idempotencyKey?: string;
	}): Promise<{ url: string }>;

	// Generate a hosted checkout URL for a ONE-TIME payment (credit packs).
	// Deliberately a separate optional method rather than a mode flag on
	// createCheckoutSession: an existing provider that ignored an added flag
	// would silently open a subscription checkout for a payment request. When
	// absent, the wallet checkout route returns 501.
	createPaymentCheckoutSession?(opts: {
		customerId: string;
		// Ad-hoc price in the smallest currency unit; ignored when priceId is set.
		amount: bigint;
		currency: string;
		name: string;
		quantity?: number;
		// An existing provider Price id to charge instead of the ad-hoc amount.
		priceId?: string;
		// Save the card to the customer for later off-session charges (wallet
		// auto-recharge). Requires the operator to have obtained the buyer's
		// consent to store it. Ignored by providers without off-session support.
		savePaymentMethod?: boolean;
		metadata: Record<string, string>;
		successUrl: string;
		cancelUrl: string;
	}): Promise<{ url: string; sessionId: string }>;

	// Charge a stored customer's saved card off-session (no user present) — the
	// engine behind wallet auto-recharge. Optional: when absent, auto-recharge
	// is inert (checkReadiness warns). Must be idempotent on idempotencyKey.
	// NEVER throws — every outcome resolves to a status so the caller can decide:
	//   'succeeded'        funds captured (providerTxId set) → credit.
	//   'requires_action'  SCA needed — a definitive soft-fail; back off.
	//   'failed'           definitive decline / no card on file; back off.
	//   'unknown'          INDETERMINATE (network/timeout/API error): the charge
	//                      MAY have captured. The caller must NOT re-charge with a
	//                      fresh idempotency key and must NOT count it as a
	//                      decline — retry later with the SAME idempotencyKey so
	//                      the provider dedupes to the original PaymentIntent.
	chargeOffSession?(opts: {
		customerId: string;
		// The specific saved card to charge (the one consented to at the pack
		// checkout). When omitted, the provider falls back to the customer's most
		// recently attached card.
		paymentMethodId?: string | null;
		amount: bigint; // smallest currency unit
		currency: string;
		idempotencyKey: string;
		metadata: Record<string, string>;
	}): Promise<{
		providerTxId: string | null;
		status: 'succeeded' | 'requires_action' | 'failed' | 'unknown';
	}>;

	// Like chargeOffSession, but bills the saved card through a real INVOICE so the
	// buyer gets a proper invoice (number + downloadable PDF + hosted page) plus the
	// card receipt — the record a one-time charge alone can't provide. Same status
	// contract as chargeOffSession, and same idempotency requirement: the key must
	// be reused on retry so a double-submit dedupes to one invoice/charge. Returns
	// the invoice artifacts for reference; `providerTxId` is the invoice's
	// PaymentIntent (the wallet credit + refund clawback key). Optional — a provider
	// without it falls back to chargeOffSession (receipt only).
	chargeViaInvoice?(opts: {
		customerId: string;
		paymentMethodId?: string | null;
		amount: bigint; // smallest currency unit
		currency: string;
		description: string;
		idempotencyKey: string;
		metadata: Record<string, string>;
	}): Promise<{
		status: 'succeeded' | 'requires_action' | 'failed' | 'unknown';
		providerTxId: string | null;
		invoiceId: string | null;
		invoiceNumber: string | null;
		hostedInvoiceUrl: string | null;
		invoicePdf: string | null;
	}>;

	// Resolve the payment method a completed payment used, so auto-recharge can
	// persist and later re-charge the exact card the buyer consented to. Optional;
	// when absent, auto-recharge falls back to the newest card at charge time.
	getPaymentMethodForIntent?(providerTxId: string): Promise<string | null>;

	// Resolve live price data (source of truth for amount/currency/interval) from
	// the provider. Used by read-through pricing hydration.
	resolvePriceById(priceId: string): Promise<IResolvedPrice | null>;
	resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>;

	// Change an existing subscription's price in place. prorationBehavior selects
	// how the prorated difference is settled: 'always_invoice' (default) invoices
	// it immediately (an upgrade — pay the difference now); 'create_prorations'
	// accrues it as a credit/debit on the next invoice (a downgrade — credit the
	// unused higher-plan time).
	updateSubscription(opts: {
		subscriptionId: string;
		priceId: string;
		prorationBehavior?: 'always_invoice' | 'create_prorations';
	}): Promise<{
		status: string;
		currentPeriodStart: Date | null;
		currentPeriodEnd: Date | null;
	}>;

	// Cancel a subscription — at period end (keep access until paid-through) or
	// immediately. Optional: when absent, the first-party cancel route answers
	// 501 (the hosted billing portal remains a self-serve fallback).
	cancelSubscription?(opts: { subscriptionId: string; atPeriodEnd: boolean }): Promise<ISubscriptionChange>;

	// Un-cancel a subscription scheduled to cancel at period end. Optional; the
	// reactivate route answers 501 when absent.
	reactivateSubscription?(opts: { subscriptionId: string }): Promise<ISubscriptionChange>;

	// Retrieve the customer's card on file (the "last added" payment method) for
	// display — brand/last4/expiry only, never the full number. When a specific
	// consented card id is known (from the wallet customer) it is retrieved
	// directly; otherwise the provider resolves the customer's default/newest
	// card. Optional; when absent, the payment-method route answers 501.
	getPaymentMethod?(opts: {
		customerId: string;
		paymentMethodId?: string | null;
	}): Promise<INormalizedCard | null>;

	// Create a SetupIntent so a card can be added/replaced IN-APP via the
	// provider's embedded card element (e.g. Stripe Payment Element) with NO
	// hosted-checkout redirect. The client confirms it with the returned client
	// secret, which attaches the card to the customer. Optional; the in-app
	// setup route answers 501 when absent.
	createSetupIntent?(opts: {
		customerId: string;
	}): Promise<{ clientSecret: string; setupIntentId: string }>;

	// Make an already-attached card the customer's default for off-session +
	// invoice charges. MUST verify the card is attached to THIS customer and
	// reject otherwise, so a caller can never point the default at a card that
	// isn't theirs. Optional; the save route answers 501 when absent.
	setDefaultPaymentMethod?(opts: { customerId: string; paymentMethodId: string }): Promise<void>;

	// Detach (remove) a saved card from the customer — the in-app "remove card".
	// MUST verify the card belongs to this customer. Optional; the remove route
	// answers 501 when absent.
	detachPaymentMethod?(opts: { customerId: string; paymentMethodId: string }): Promise<void>;

	// List the customer's invoices, newest first, for an in-app billing history
	// that links out to the provider-hosted invoice. Optional; when absent, the
	// invoices route answers 501.
	listInvoices?(opts: { customerId: string; limit?: number }): Promise<INormalizedInvoiceSummary[]>;

	// Generate a hosted billing portal URL
	createPortalSession(opts: { customerId: string; returnUrl: string }): Promise<{ url: string }>;

	// Verify and parse an incoming webhook
	constructEvent(opts: {
		payload: string;
		signature: string;
		secret: string;
	}): Promise<IBillingEvent>;
}
