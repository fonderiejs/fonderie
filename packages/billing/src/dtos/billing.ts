import type { IPlan, ISubscription, IUsageRecord } from '../types';

export interface IPlanDTO {
	id:             string
	name:           string
	seats:          number | null
	trialDays:      number
	monthlyAmount:  number | null
	monthlyPriceId: string | null
	yearlyAmount:   number | null
	yearlyPriceId:  string | null
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

export function toPlanDTO(plan: IPlan): IPlanDTO {
	return {
		id:             plan.id,
		name:           plan.name,
		seats:          plan.seats,
		trialDays:      plan.trialDays,
		monthlyAmount:  plan.monthlyAmount,
		monthlyPriceId: plan.monthlyPriceId,
		yearlyAmount:   plan.yearlyAmount,
		yearlyPriceId:  plan.yearlyPriceId,
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
