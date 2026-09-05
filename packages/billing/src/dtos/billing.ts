import type { IPlan, IPlanFeature, ISubscription, SubscriberType } from '../types';

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
	/** True when pricing was served from stale cache (transfer window / provider outage). */
	pricingStale?: boolean;
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

// The pg driver returns TIMESTAMPTZ columns as Date objects (no type-parser
// override exists); the DTO's string fields were only correct by accident of
// Date.toJSON. Normalize explicitly, like the wallet path does.
const isoOrNull = (value: string | Date | null): string | null =>
	value == null ? null : new Date(value).toISOString();

export function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO {
	return {
		id: sub.id,
		subscriberType: sub.subscriberType,
		subscriberId: sub.subscriberId,
		plan: sub.plan,
		interval: sub.interval,
		status: sub.status,
		cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
		currentPeriodStart: isoOrNull(sub.currentPeriodStart),
		currentPeriodEnd: isoOrNull(sub.currentPeriodEnd),
		trialEndsAt: isoOrNull(sub.trialEndsAt),
		createdAt: isoOrNull(sub.createdAt) ?? '',
	};
}

