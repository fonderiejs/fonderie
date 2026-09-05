import type { IBillingProvider } from './providers/types';
import type { IWalletRate, PolicyEntry, SubscriberType } from './types';
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

/**
 * Per-plan wallet economics. Requires config.wallet to be set — a plan-level
 * wallet without the global opt-in is ignored (with a boot warning).
 */
export interface IBillingPlanWallet {
	/** Overrides the global wallet currency for this plan's grants and rates. */
	currency?: string;
	/** Display precision override. */
	precision?: number;
	/**
	 * Credits auto-granted once per grantPeriod, applied lazily by withBilling
	 * on the subscriber's first request of the period. Only granted while the
	 * subscription is active or trialing (no new credit while payment fails).
	 */
	grantAmount?: bigint;
	/** Grant cadence for grantAmount. Default 'month'. */
	grantPeriod?: 'month' | 'week' | 'day';
	/** How far below zero rate debits may take the balance. Default 0n (block at zero). */
	overdraftLimit?: bigint;
	/** Per-metric unit costs, e.g. { 'sms:send': { cost: 75n, unit: 'msg' } }. */
	rates?: Record<string, IWalletRate>;
	/**
	 * Balance at/below which withBilling emits a low-balance signal
	 * (`wallet.low_balance` domain event + `billing.credits-low` notification),
	 * once per subscriber per session. Omit to disable.
	 */
	lowBalanceAt?: bigint;
	/**
	 * Automatic off-session top-up. When set and the subscriber's balance drops
	 * to `threshold`, withBilling charges the named credit pack's price against
	 * the card saved at the last pack purchase and credits its credits — no
	 * user interaction. Requires: the provider implements chargeOffSession, and
	 * the buyer previously purchased a pack (so a customer + card is on file;
	 * that checkout must have obtained consent to store the card for later
	 * charges). Omit to disable (the low-balance notice still informs).
	 */
	autoRecharge?: IBillingWalletAutoRecharge;
}

export interface IBillingWalletAutoRecharge {
	/** Balance at/below which a top-up is attempted (wallet's smallest unit). */
	threshold: bigint;
	/** A credit pack id from config.wallet.creditPacks — its price is charged, its credits added. */
	packId: string;
	/**
	 * Minimum seconds between top-up ATTEMPTS for one subscriber (a failed
	 * attempt still consumes the window, so a declined card can't be hammered).
	 * Default 3600 (1h); floored at 1s. Keep it well under ~24h: a lost-response
	 * ("unknown") charge is retried with the same provider idempotency key so the
	 * charge is deduped, and Stripe expires idempotency keys after ~24h — a
	 * cooldown that long could let the post-expiry retry double-charge.
	 */
	cooldownSeconds?: number;
	/**
	 * Consecutive failed attempts after which auto-recharge is disabled for the
	 * subscriber until a new pack purchase re-arms it. Default 3.
	 */
	maxConsecutiveFailures?: number;
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
	wallet?: IBillingPlanWallet;
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
	/**
	 * ISO 4217 PAYMENT currency for the provider charge; defaults to the
	 * buyer's wallet currency. Credits always land in the buyer's wallet
	 * currency regardless of what the charge was priced in.
	 */
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
	 * Signing secret for POST /billing/webhook/payment. REQUIRED for pack
	 * purchases: the route answers 500 until it is set, and it deliberately
	 * does NOT fall back to the subscription webhook's secret — per-endpoint
	 * secrets keep a delivery captured for one endpoint from replaying
	 * against the other.
	 */
	webhookSecret?: string;
	creditPacks?: IBillingCreditPack[];
}

// The party to notify for a subscriber's money events. Resolved by the app —
// billing's money flows are webhook-driven (no session), so billing has a
// subscriberId but not an address. Returning null (or omitting the resolver)
// means no notification is sent; when payments are enabled that is flagged by
// BillingModule.checkReadiness (§ Communication & Record Integrity).
export interface IBillingRecipient {
	email?: string | null;
	phone?: string | null;
	deviceToken?: string | null;
}

export type ResolveRecipient = (
	subscriberType: SubscriberType,
	subscriberId: string,
) => IBillingRecipient | null | Promise<IBillingRecipient | null>;

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
	/**
	 * Resolves who to email/SMS for a subscriber's money events (receipt,
	 * refund, failed payment, low balance). Required, with an EventBus, for
	 * billing to send customer communications — its absence while payments are
	 * enabled is a production readiness error (see BillingModule.checkReadiness).
	 */
	resolveRecipient?: ResolveRecipient;
}

export const MESSAGE_KEYS = {
	limitWarning: 'billing.limit-warning',
	limitReached: 'billing.limit-reached',
	limitBlocked: 'billing.limit-blocked',
	// Money-flow communications. Each is a courier template type; the operator
	// supplies the template, billing supplies the `data` (see
	// docs/BILLING-CAPABILITY-AUDIT.md for the payload of each). Emitted now
	// (Phase 2): paymentReceipt (pack purchase), paymentFailed (past_due
	// dunning), subscriptionCanceled, creditsLow (low wallet balance).
	paymentReceipt: 'billing.payment-receipt',
	paymentFailed: 'billing.payment-failed',
	subscriptionCanceled: 'billing.subscription-canceled',
	creditsLow: 'billing.credits-low',
	refundProcessed: 'billing.refund-processed',
	// A wallet auto-recharge attempt failed (card declined / needs auth / no
	// card on file). Success reuses the payment-receipt notice.
	autoRechargeFailed: 'billing.auto-recharge-failed',
	// A subscription renewal invoice was paid (a receipt per renewal). Phase 3b.
	renewalReceipt: 'billing.renewal-receipt',
	// A trial is about to end (customer.subscription.trial_will_end). Phase 3b.
	trialEnding: 'billing.trial-ending',
} as const;

export type BillingMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

// Domain events published on the @fonderie/events EventBus (§ Phase 1 of
// docs/BILLING-CAPABILITY-AUDIT.md). Consumed in-process by any subscriber
// and — when the payload carries a top-level workspaceId — fanned out to
// customer endpoints by @fonderie/webhooks. Naming mirrors auth/customers
// (fonderie.<domain>.<entity>.<verb>). These are the durable "what happened"
// records; the customer-facing email/SMS is a separate NOTIFICATION_EVENT
// (Phase 2).
export const EVENT_KEYS = {
	subscriptionCreated: 'fonderie.billing.subscription.created',
	subscriptionUpdated: 'fonderie.billing.subscription.updated',
	subscriptionCanceled: 'fonderie.billing.subscription.canceled',
	subscriptionPastDue: 'fonderie.billing.subscription.past_due',
	walletCredited: 'fonderie.billing.wallet.credited',
	walletDebited: 'fonderie.billing.wallet.debited',
	walletLowBalance: 'fonderie.billing.wallet.low_balance',
	creditPackPurchased: 'fonderie.billing.credit_pack.purchased',
	paymentRefunded: 'fonderie.billing.payment.refunded',
	paymentFailed: 'fonderie.billing.payment.failed',
	autoRechargeFailed: 'fonderie.billing.auto_recharge.failed',
	grantApplied: 'fonderie.billing.grant.applied',
	invoicePaid: 'fonderie.billing.invoice.paid',
	invoicePaymentFailed: 'fonderie.billing.invoice.payment_failed',
	subscriptionTrialWillEnd: 'fonderie.billing.subscription.trial_will_end',
} as const;

export type BillingEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];
