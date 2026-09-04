import type { IBillingProvider } from './providers/types';
import type { PolicyEntry } from './types';
import type { ICounterBackend } from './backends/types';

export interface IBillingPlanPrice {
	/** Stable Stripe Price lookup_key, e.g. "pro_monthly". Preferred reference. */
	lookupKey?: string;
	/** Stripe price id. Used for hydration and as a lookup_key fallback. */
	priceId?: string;
	/**
	 * Display amount in the smallest currency unit (bigint, e.g. 1999n = $19.99) —
	 * the seed value written to fonderie_plans and the fallback shown (flagged
	 * pricingStale) when hydration is off or Stripe is unreachable. When
	 * hydration resolves a live price, the live amount wins.
	 */
	amount?: bigint;
}

/**
 * Read-through pricing: amount/currency come from Stripe (source of truth) rather
 * than the duplicated `amount` above. Gated by `hydration` (kill-switch, §16.9).
 * See packages/billing/docs/pricing-hydration.md.
 */
export interface IBillingPricingConfig {
	/** Kill-switch. When false (default), serve the configured amount/USD directly. */
	hydration?: boolean;
	/** Fresh-cache TTL. Default 300_000 (5m). */
	cacheTtlMs?: number;
	/** Serve last-cached price on a transient resolution miss (lookup_key transfer). Default 3_600_000 (1h). */
	transferGraceMs?: number;
	/** Max age to serve stale price during a Stripe outage before giving up. Default 86_400_000 (24h). */
	maxStaleMs?: number;
}

export interface IBillingPlanDefaults {
	warnAt?: number; // default warnAt fraction (0–1) for counter policies
	buffer?: number; // default buffer for counter policies
}

export interface IBillingPlan {
	name: string;
	description?: string;
	tier?: number;
	trialDays?: number;
	monthly?: IBillingPlanPrice;
	yearly?: IBillingPlanPrice;
	defaults?: IBillingPlanDefaults;
	policy?: Record<string, PolicyEntry>;
	metadata?: Record<string, unknown>;
}

export type RateLimitBackendConfig = 'memory' | 'db' | ICounterBackend;

export interface IBillingNotificationsConfig {
	warnAt?: boolean; // fire courier message when warnAt threshold crossed
	softHit?: boolean; // fire when soft limit crossed
}

/**
 * A purchasable credit top-up, synced to fonderie_credit_packs at boot (same
 * pattern as plans). Purchases go through the provider's one-time checkout;
 * the payment webhook credits `credits` to the buyer's wallet.
 */
export interface IBillingCreditPack {
	/** Stable identifier used by POST /billing/wallet/checkout, e.g. 'small'. */
	id: string;
	name: string;
	/** Wallet credits granted on purchase, in the smallest wallet unit. */
	credits: bigint;
	/** Purchase price in the provider's smallest currency unit. */
	priceAmount: bigint;
	/** ISO 4217. Defaults to the wallet currency. */
	currency?: string;
	/** Existing provider Price id — used instead of the ad-hoc priceAmount. */
	priceId?: string;
	/** Inactive packs stay in the DB but can no longer be checked out. */
	active?: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * Opt-in stored-value wallet. Presence of this object activates the wallet
 * subsystem (routes, credit packs, per-plan grants and rates); leaving it out
 * changes nothing for existing subscription-only consumers.
 */
export interface IBillingWalletConfig {
	/** Default wallet currency when a plan doesn't override it. Default 'USD'. */
	currency?: string;
	/** Display precision — decimal places of the smallest unit. Default 2. */
	precision?: number;
	/**
	 * Bearer token guarding POST /billing/wallet/grant (manual support/ops
	 * grants). The route is only registered when a token is configured.
	 */
	adminToken?: string;
	/**
	 * Signing secret for POST /billing/webhook/payment. Keep it separate from
	 * the subscription webhook's secret (one provider endpoint each); falls
	 * back to the top-level webhookSecret when omitted.
	 */
	webhookSecret?: string;
	creditPacks?: IBillingCreditPack[];
}

export interface IBillingConfig {
	provider: IBillingProvider;
	plans: IBillingPlan[];
	successUrl: string;
	cancelUrl: string;
	webhookSecret?: string;
	rateLimit?: { backend?: RateLimitBackendConfig };
	notifications?: IBillingNotificationsConfig;
	pricing?: IBillingPricingConfig;
	wallet?: IBillingWalletConfig;
}

export const MESSAGE_KEYS = {
	limitWarning: 'billing.limit-warning',
	limitReached: 'billing.limit-reached',
	limitBlocked: 'billing.limit-blocked',
} as const;

export type BillingMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];
