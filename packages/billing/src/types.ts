export interface ISubscription {
	id:                    string
	workspaceId:           string
	plan:                  string
	interval:              'month' | 'year'
	status:                SubscriptionStatus
	providerCustomerId:    string | null
	providerSubscriptionId: string | null
	currentPeriodStart:    string | null
	currentPeriodEnd:      string | null
	cancelAtPeriodEnd:     boolean
	trialEndsAt:           string | null
	createdAt:             string
}

export type SubscriptionStatus =
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'incomplete'
	| 'paused'

export interface IPlan {
	id:             string
	name:           string
	seats:          number | null
	trialDays:      number
	monthlyAmount:  number | null
	monthlyPriceId: string | null
	yearlyAmount:   number | null
	yearlyPriceId:  string | null
}

export interface IUsageRecord {
	id:          string
	workspaceId: string
	metric:      string
	quantity:    number
	recordedAt:  string
}
