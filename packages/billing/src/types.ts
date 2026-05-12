export type SubscriberType = 'user' | 'workspace'

export interface ISubscription {
	id:                     string
	subscriberType:         SubscriberType
	subscriberId:           string
	plan:                   string
	interval:               'month' | 'year'
	status:                 SubscriptionStatus
	providerCustomerId:     string | null
	providerSubscriptionId: string | null
	currentPeriodStart:     string | null
	currentPeriodEnd:       string | null
	cancelAtPeriodEnd:      boolean
	trialEndsAt:            string | null
	createdAt:              string
}

export type SubscriptionStatus =
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'incomplete'
	| 'paused'

export interface IPlanFeature {
	name:        string
	description: string
	enabled:     boolean
	limit?:      number
}

export interface IPlan {
	id:             string
	name:           string
	seats:          number | null
	trialDays:      number
	monthlyAmount:  number | null
	monthlyPriceId: string | null
	yearlyAmount:   number | null
	yearlyPriceId:  string | null
	description:    string | null
	tier:           number
	features:       IPlanFeature[]
	metadata:       Record<string, unknown>
}

export interface IUsageRecord {
	id:             string
	subscriberType: SubscriberType
	subscriberId:   string
	metric:         string
	quantity:       number
	recordedAt:     string
}
