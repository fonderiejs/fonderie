import type { IBillingProvider } from './providers/types';

export interface IBillingPlanPrice {
	amount:   number
	priceId?: string
}

export interface IBillingPlan {
	name:         string
	description?: string
	seats?:       number | null
	trialDays?:   number
	features?:    string[]
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
