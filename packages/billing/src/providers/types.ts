import type { BillingInterval, SubscriberType } from '../types';

// The normalized event shape — provider-agnostic
export interface IBillingEvent {
	type: string;
	subscription: INormalizedSubscription | null;
	// One-time payment completion (credit pack purchase). Only set by providers
	// that support one-time payments — optional so existing custom providers
	// stay source-compatible.
	payment?: INormalizedPayment | null;
	// A refund or chargeback reversing a prior one-time payment. Optional and
	// nullable for the same source-compatibility reason as `payment`; only
	// providers that normalize refund/dispute events set it.
	reversal?: INormalizedReversal | null;
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
		metadata: Record<string, string>;
		successUrl: string;
		cancelUrl: string;
	}): Promise<{ url: string; sessionId: string }>;

	// Resolve live price data (source of truth for amount/currency/interval) from
	// the provider. Used by read-through pricing hydration.
	resolvePriceById(priceId: string): Promise<IResolvedPrice | null>;
	resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>;

	// Change an existing subscription's price in place (upgrade), invoicing the
	// prorated difference immediately.
	updateSubscription(opts: {
		subscriptionId: string;
		priceId: string;
	}): Promise<{
		status: string;
		currentPeriodStart: Date | null;
		currentPeriodEnd: Date | null;
	}>;

	// Generate a hosted billing portal URL
	createPortalSession(opts: { customerId: string; returnUrl: string }): Promise<{ url: string }>;

	// Verify and parse an incoming webhook
	constructEvent(opts: {
		payload: string;
		signature: string;
		secret: string;
	}): Promise<IBillingEvent>;
}
