import type { IPlan, IPlanFeature, ISubscription, IUsageRecord } from '../types';

export interface IPlanDTO {
	id:          string
	planId:      string
	name:        string
	description: string
	tier:        number
	pricing: {
		monthly:          number
		yearly:           number
		currency:         string
		monthlyFormatted: string
		yearlyFormatted:  string
	}
	features: IPlanFeature[]
	limits:   Record<string, number>
	metadata: Record<string, unknown>
}

export interface ISubscriptionDTO {
	id:                    string
	workspaceId:           string
	plan:                  string
	interval:              string
	status:                string
	cancelAtPeriodEnd:     boolean
	currentPeriodStart:    string | null
	currentPeriodEnd:      string | null
	trialEndsAt:           string | null
	createdAt:             string
}

export interface IUsageRecordDTO {
	id:          string
	workspaceId: string
	metric:      string
	quantity:    number
	recordedAt:  string
}

function formatPrice(amount: number | null, period: 'month' | 'year'): string {
	if (!amount) return 'Free'
	return `$${amount}/${period}`
}

export function toPlanDTO(plan: IPlan): IPlanDTO {
	return {
		id:          plan.id,
		planId:      plan.name.toUpperCase(),
		name:        plan.name,
		description: plan.description ?? '',
		tier:        plan.tier,
		pricing: {
			monthly:          plan.monthlyAmount ?? 0,
			yearly:           plan.yearlyAmount  ?? 0,
			currency:         'USD',
			monthlyFormatted: formatPrice(plan.monthlyAmount, 'month'),
			yearlyFormatted:  formatPrice(plan.yearlyAmount,  'year'),
		},
		features: Array.isArray(plan.features) ? plan.features : [],
		limits:   (plan.limits   && typeof plan.limits   === 'object') ? plan.limits   as Record<string, number>  : {},
		metadata: (plan.metadata && typeof plan.metadata === 'object') ? plan.metadata as Record<string, unknown> : {},
	}
}

export function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO {
	return {
		id:                 sub.id,
		workspaceId:        sub.workspaceId,
		plan:               sub.plan,
		interval:           sub.interval,
		status:             sub.status,
		cancelAtPeriodEnd:  sub.cancelAtPeriodEnd,
		currentPeriodStart: sub.currentPeriodStart,
		currentPeriodEnd:   sub.currentPeriodEnd,
		trialEndsAt:        sub.trialEndsAt,
		createdAt:          sub.createdAt,
	}
}

export function toUsageRecordDTO(record: IUsageRecord): IUsageRecordDTO {
	return {
		id:          record.id,
		workspaceId: record.workspaceId,
		metric:      record.metric,
		quantity:    record.quantity,
		recordedAt:  record.recordedAt,
	}
}
