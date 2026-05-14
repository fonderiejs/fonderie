import type { IPlan, IPlanFeature, ISubscription, IUsageRecord, SubscriberType } from '../types';

export interface IPlanDTO {
	id: string;
	planId: string;
	name: string;
	description: string;
	tier: number;
	seats: number | null;
	trialDays: number;
	pricing: {
		monthly: number; // in cents, e.g. 1999 = $19.99
		yearly: number; // in cents
		currency: string; // ISO 4217, e.g. 'USD'
	};
	features: IPlanFeature[];
	metadata: Record<string, unknown>;
}

export interface ISubscriptionDTO {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	interval: string;
	status: string;
	cancelAtPeriodEnd: boolean;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	trialEndsAt: string | null;
	createdAt: string;
}

export interface IUsageRecordDTO {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	metric: string;
	quantity: number;
	recordedAt: string;
}

export function toPlanDTO(plan: IPlan): IPlanDTO {
	return {
		id: plan.id,
		planId: plan.name.toUpperCase(),
		name: plan.name,
		description: plan.description ?? '',
		tier: plan.tier,
		seats: plan.seats,
		trialDays: plan.trialDays,
		pricing: {
			monthly: plan.monthlyAmount ?? 0,
			yearly: plan.yearlyAmount ?? 0,
			currency: 'USD',
		},
		features: Array.isArray(plan.features) ? plan.features : [],
		metadata:
			plan.metadata && typeof plan.metadata === 'object'
				? (plan.metadata as Record<string, unknown>)
				: {},
	};
}

export function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO {
	return {
		id: sub.id,
		subscriberType: sub.subscriberType,
		subscriberId: sub.subscriberId,
		plan: sub.plan,
		interval: sub.interval,
		status: sub.status,
		cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
		currentPeriodStart: sub.currentPeriodStart,
		currentPeriodEnd: sub.currentPeriodEnd,
		trialEndsAt: sub.trialEndsAt,
		createdAt: sub.createdAt,
	};
}

export function toUsageRecordDTO(record: IUsageRecord): IUsageRecordDTO {
	return {
		id: record.id,
		subscriberType: record.subscriberType,
		subscriberId: record.subscriberId,
		metric: record.metric,
		quantity: record.quantity,
		recordedAt: record.recordedAt,
	};
}
