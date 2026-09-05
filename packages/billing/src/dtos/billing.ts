import type {
	IPlan,
	IPlanFeature,
	ISubscription,
	IWalletLedgerEntry,
	SubscriberType,
	WalletLedgerType,
} from '../types';

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

// Wallet amounts are bigint on the server and would throw in JSON.stringify —
// the DTO layer serializes every money field as a digit string.
export interface IWalletDTO {
	balance: string; // smallest currency unit, e.g. '1999' = $19.99 at precision 2
	currency: string;
	precision: number;
}

export interface IWalletTransactionDTO {
	id: string;
	type: WalletLedgerType;
	amount: string; // signed: positive = credit, negative = debit
	balanceAfter: string;
	currency: string;
	description: string | null;
	providerTxId: string | null;
	metadata: Record<string, unknown>;
	createdAt: string;
}

export function toWalletDTO(balance: bigint, currency: string, precision: number): IWalletDTO {
	return { balance: balance.toString(), currency, precision };
}

export function toWalletTransactionDTO(entry: IWalletLedgerEntry): IWalletTransactionDTO {
	return {
		id: entry.id,
		type: entry.type,
		amount: entry.amount.toString(),
		balanceAfter: entry.balanceAfter.toString(),
		currency: entry.currency,
		description: entry.description,
		providerTxId: entry.providerTxId,
		metadata: entry.metadata,
		createdAt: entry.createdAt,
	};
}
