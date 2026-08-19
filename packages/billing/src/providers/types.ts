import type { SubscriberType } from '../types';

// The normalized event shape — provider-agnostic
export interface IBillingEvent {
	type: string;
	subscription: INormalizedSubscription | null;
}

export interface INormalizedSubscription {
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	status: string;
	providerCustomerId: string;
	providerSubscriptionId: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: Date | null;
	interval: 'month' | 'year';
}

// Live price resolved from the provider (Stripe = source of truth).
export interface IResolvedPrice {
	priceId: string;
	lookupKey: string | null;
	unitAmount: number; // cents
	currency: string; // ISO 4217 (Stripe lowercases)
	interval: 'month' | 'year';
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
