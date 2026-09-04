export type SubscriberType = 'user' | 'workspace';

// Billing interval — one source for the 'month' | 'year' literals.
export const BILLING_INTERVAL = { MONTH: 'month', YEAR: 'year' } as const;
export type BillingInterval = (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];

// ── Policy ────────────────────────────────────────────────────────

export type PolicyEntry =
	| { enabled: boolean }
	| {
			limit: number | null; // advertised ceiling; null = unlimited
			buffer?: number; // unadvertised grace on top of limit
			warnAt?: number; // fraction of limit to trigger warning (0–1)
			window?: string; // '1d' | '30d' | '1h' — if set, auto rate-limited
			unit?: string; // display only, e.g. 'mb', 'requests'
	  };

export type LimitStatus = 'ok' | 'warning' | 'over_limit' | 'blocked';

export type IPolicyStatus =
	| { type: 'feature'; enabled: boolean }
	| {
			type: 'counter';
			limit: number | null; // advertised — safe to send to client
			used: number;
			status: LimitStatus;
			resetsAt: string | null; // ISO string for windowed counters, null otherwise
	  };

// Per-metric wallet pricing (plan-defined unit economics).
export interface IWalletRate {
	cost: bigint; // per unit, in the smallest wallet-currency unit
	unit?: string; // display only, e.g. 'msg', 'min'
}

// Wallet snapshot cached on ctx.meta['billing'] by withBilling when the
// subscriber's plan defines wallet economics. Server-side only — bigint
// values here never hit JSON.stringify; the HTTP surface uses IWalletDTO.
export interface IWalletContext {
	balance: bigint;
	currency: string;
	precision: number;
	overdraftLimit: bigint;
	rates: Record<string, IWalletRate>;
}

export interface IBillingContext {
	subscriber: { type: SubscriberType; id: string };
	plan: string;
	active: boolean; // subscription is active or trialing
	statuses: Record<string, IPolicyStatus>;
	wallet?: IWalletContext;
}

// ── Subscription ──────────────────────────────────────────────────

export interface ISubscription {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	plan: string;
	interval: 'month' | 'year';
	status: SubscriptionStatus;
	providerCustomerId: string | null;
	providerSubscriptionId: string | null;
	currentPeriodStart: string | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: string | null;
	createdAt: string;
}

export type SubscriptionStatus =
	| 'trialing'
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'incomplete'
	| 'paused';

// ── DB plan (read from fonderie_plans table) ──────────────────────

export interface IPlan {
	id: string;
	name: string;
	seats: number | null;
	trialDays: number;
	monthlyAmount: number | null;
	monthlyPriceId: string | null;
	yearlyAmount: number | null;
	yearlyPriceId: string | null;
	description: string | null;
	tier: number;
	features: IPlanFeature[];
	metadata: Record<string, unknown>;
}

export interface IPlanFeature {
	name: string;
	description: string;
	enabled: boolean;
	limit?: number;
}

// ── Wallet ────────────────────────────────────────────────────────

export const WALLET_LEDGER_TYPES = ['purchase', 'grant', 'usage', 'refund', 'adjustment'] as const;
export type WalletLedgerType = (typeof WALLET_LEDGER_TYPES)[number];

export interface IWalletBalance {
	balance: bigint;
	version: number;
	updatedAt: string | null; // ISO string; null when no balance row exists yet
}

export interface IWalletLedgerEntry {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	currency: string;
	type: WalletLedgerType;
	amount: bigint; // signed: positive = credit, negative = debit
	balanceAfter: bigint;
	description: string | null;
	idempotencyKey: string;
	metadata: Record<string, unknown>;
	providerTxId: string | null;
	createdAt: string;
}

// ── Usage ─────────────────────────────────────────────────────────

export interface IUsageRecord {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	metric: string;
	quantity: number;
	recordedAt: string;
}
