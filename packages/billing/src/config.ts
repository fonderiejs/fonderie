import type { IBillingProvider } from './providers/types';
import type { IPlanFeature }     from './types';

export interface IBillingPlanPrice {
	amount:   number
	priceId?: string
}

export interface IBillingPlan {
	name:         string
	description?: string
	tier?:        number
	seats?:       number | null
	trialDays?:   number
	features?:    IPlanFeature[]
	metadata?:    Record<string, unknown>
	monthly?:     IBillingPlanPrice
	yearly?:      IBillingPlanPrice
}

export interface IBillingConfig {
	provider:       IBillingProvider
	plans:          IBillingPlan[]
	webhookSecret?: string
	successUrl:    string
	cancelUrl:     string
}
