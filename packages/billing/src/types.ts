export type SubscriberType = 'user' | 'workspace'

// ── Policy ────────────────────────────────────────────────────────

export type PolicyEntry =
	| { enabled: boolean }
	| {
		limit:   number | null   // advertised ceiling; null = unlimited
		buffer?: number          // unadvertised grace on top of limit
		warnAt?: number          // fraction of limit to trigger warning (0–1)
		window?: string          // '1d' | '30d' | '1h' — if set, auto rate-limited
		unit?:   string          // display only, e.g. 'mb', 'requests'
	  }

export type LimitStatus = 'ok' | 'warning' | 'over_limit' | 'blocked'

export type IPolicyStatus =
	| { type: 'feature'; enabled: boolean }
	| {
		type:     'counter'
		limit:    number | null   // advertised — safe to send to client
		used:     number
		status:   LimitStatus
		resetsAt: string | null   // ISO string for windowed counters, null otherwise
	  }

export interface IBillingContext {
	subscriber: { type: SubscriberType; id: string }
	plan:       string
	active:     boolean                          // subscription is active or trialing
	statuses:   Record<string, IPolicyStatus>
}

// ── Subscription ──────────────────────────────────────────────────

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

// ── DB plan (read from fonderie_plans table) ──────────────────────

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

export interface IPlanFeature {
	name:        string
	description: string
	enabled:     boolean
	limit?:      number
}

// ── Usage ─────────────────────────────────────────────────────────

export interface IUsageRecord {
	id:             string
	subscriberType: SubscriberType
	subscriberId:   string
	metric:         string
	quantity:       number
	recordedAt:     string
}
