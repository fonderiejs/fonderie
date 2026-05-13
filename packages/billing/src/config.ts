import type { IBillingProvider }  from './providers/types'
import type { PolicyEntry }        from './types'
import type { ICounterBackend }    from './backends/types'

export interface IBillingPlanPrice {
	amount:   number
	priceId?: string
}

export interface IBillingPlanDefaults {
	warnAt?: number   // default warnAt fraction (0–1) for counter policies
	buffer?: number   // default buffer for counter policies
}

export interface IBillingPlan {
	name:         string
	description?: string
	tier?:        number
	trialDays?:   number
	monthly?:     IBillingPlanPrice
	yearly?:      IBillingPlanPrice
	defaults?:    IBillingPlanDefaults
	policy?:      Record<string, PolicyEntry>
	metadata?:    Record<string, unknown>
}

export type RateLimitBackendConfig = 'memory' | 'db' | ICounterBackend

export interface IBillingNotificationsConfig {
	warnAt?:  boolean   // fire courier message when warnAt threshold crossed
	softHit?: boolean   // fire when soft limit crossed
}

export interface IBillingConfig {
	provider:        IBillingProvider
	plans:           IBillingPlan[]
	successUrl:      string
	cancelUrl:       string
	webhookSecret?:  string
	rateLimit?:      { backend?: RateLimitBackendConfig }
	notifications?:  IBillingNotificationsConfig
}

export const MESSAGE_KEYS = {
	limitWarning: 'billing.limit-warning',
	limitReached: 'billing.limit-reached',
	limitBlocked: 'billing.limit-blocked',
} as const

export type BillingMessageKey = typeof MESSAGE_KEYS[keyof typeof MESSAGE_KEYS]
