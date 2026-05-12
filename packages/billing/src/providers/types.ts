import type { SubscriberType } from '../types'

// The normalized event shape — provider-agnostic
export interface IBillingEvent {
	type:         string
	subscription: INormalizedSubscription | null
}

export interface INormalizedSubscription {
	subscriberType:          SubscriberType
	subscriberId:            string
	plan:                    string
	status:                  string
	providerCustomerId:      string
	providerSubscriptionId:  string
	currentPeriodStart:      Date
	currentPeriodEnd:        Date
	cancelAtPeriodEnd:       boolean
	trialEndsAt:             Date | null
}

// The one interface every handler calls
export interface IBillingProvider {
	name: string

	// Create or retrieve a customer record with the provider
	createCustomer(opts: {
		email:          string
		subscriberType: SubscriberType
		subscriberId:   string
		userId:         string
	}): Promise<{ customerId: string }>

	// Generate a hosted checkout URL
	createCheckoutSession(opts: {
		customerId:     string
		priceId:        string
		subscriberType: SubscriberType
		subscriberId:   string
		trialDays?:     number
		successUrl:     string
		cancelUrl:      string
	}): Promise<{ url: string }>

	// Generate a hosted billing portal URL
	createPortalSession(opts: {
		customerId: string
		returnUrl:  string
	}): Promise<{ url: string }>

	// Verify and parse an incoming webhook
	constructEvent(opts: {
		payload:   string
		signature: string
		secret:    string
	}): Promise<IBillingEvent>
}
