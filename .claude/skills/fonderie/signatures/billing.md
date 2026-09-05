<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/billing — signatures

## @fonderie/billing

Subpath exports: `@fonderie/billing/types`, `@fonderie/billing/middleware`, `@fonderie/billing/migrations`

```ts
new BillingModule(store: IStoreAdapter, config: IBillingConfig, bus?: EventBus | undefined): BillingModule
  .name: "@fonderie/billing"
  .deps: string[]
  .install(app: IFonderieApp): Promise<void>
  .checkReadiness(): IReadinessProblem[]

new StripeProvider(secretKey: string, webhookSecret?: string | undefined): StripeProvider
  .name: "stripe"
  .createCustomer(opts: { email: string; subscriberType: SubscriberType; subscriberId: string; userId: string; }): Promise<{ customerId: string; }>
  .createCheckoutSession(opts: { customerId: string; priceId: string; subscriberType: SubscriberType; subscriberId: string; trialDays?: number; successUrl: string; cancelUrl: string; }): Promise<{ url: string; }>
  .createPaymentCheckoutSession(opts: { customerId: string; amount: bigint; currency: string; name: string; quantity?: number; priceId?: string; savePaymentMethod?: boolean; metadata: Record<string, string>; successUrl: string; cancelUrl: string; }): Promise<...>
  .chargeOffSession(opts: { customerId: string; amount: bigint; currency: string; idempotencyKey: string; metadata: Record<string, string>; }): Promise<{ providerTxId: string | null; status: "succeeded" | "requires_action" | "failed" | "unknown"; }>
  .resolvePriceById(priceId: string): Promise<IResolvedPrice | null>
  .resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>
  .updateSubscription(opts: { subscriptionId: string; priceId: string; }): Promise<{ status: string; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; }>
  .cancelSubscription(opts: { subscriptionId: string; atPeriodEnd: boolean; }): Promise<ISubscriptionChange>
  .reactivateSubscription(opts: { subscriptionId: string; }): Promise<ISubscriptionChange>
  .createPortalSession(opts: { customerId: string; returnUrl: string; }): Promise<{ url: string; }>
  .constructEvent(opts: { payload: string; signature: string; secret: string; }): Promise<IBillingEvent>

function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware

function withBilling(store: IStoreAdapter, config: IBillingConfig, backend: ICounterBackend, bus?: EventBus | undefined): Middleware

function hasFeature(ctx: IFonderieContext, key: string): boolean

function getPlanLimit(ctx: IFonderieContext, key: string): number | null

function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null

function requireFeature(key: string): Middleware

function getWalletStatus(ctx: IFonderieContext): IWalletContext | null

function getWalletRate(ctx: IFonderieContext, metric: string): bigint | null

function requireWalletBalance(metric: string): Middleware

function debitWalletForMetric(ctx: IFonderieContext, metric: string, opts: { idempotencyKey: string; quantity?: number; description?: string; metadata?: Record<string, unknown>; }, store: IStoreAdapter): Promise<...>

function insufficientCreditsResponse(err: InsufficientFundsError, metric?: string | undefined): Response

const MESSAGE_KEYS: { readonly limitWarning: "billing.limit-warning"; readonly limitReached: "billing.limit-reached"; readonly limitBlocked: "billing.limit-blocked"; readonly paymentReceipt: "billing.payment-receipt"; readonly paymentFailed: "billing.payment-failed"; readonly subscriptionCanceled: "billing.subscription-canceled"; readonly creditsLow: "billing.credits-low"; readonly refundProcessed: "billing.refund-processed"; readonly autoRechargeFailed: "billing.auto-recharge-failed"; readonly renewalReceipt: "billing.renewal-receipt"; readonly trialEnding: "billing.trial-ending"; }

const EVENT_KEYS: { readonly subscriptionCreated: "fonderie.billing.subscription.created"; readonly subscriptionUpdated: "fonderie.billing.subscription.updated"; readonly subscriptionCanceled: "fonderie.billing.subscription.canceled"; readonly subscriptionPastDue: "fonderie.billing.subscription.past_due"; readonly walletCredited: "fonderie.billing.wallet.credited"; readonly walletDebited: "fonderie.billing.wallet.debited"; readonly walletLowBalance: "fonderie.billing.wallet.low_balance"; readonly creditPackPurchased: "fonderie.billing.credit_pack.purchased"; readonly paymentRefunded: "fonderie.billing.payment.refunded"; readonly paymentFailed: "fonderie.billing.payment.failed"; readonly autoRechargeFailed: "fonderie.billing.auto_recharge.failed"; readonly grantApplied: "fonderie.billing.grant.applied"; readonly invoicePaid: "fonderie.billing.invoice.paid"; readonly invoicePaymentFailed: "fonderie.billing.invoice.payment_failed"; readonly subscriptionTrialWillEnd: "fonderie.billing.subscription.trial_will_end"; }

interface IBillingConfig {
    provider: IBillingProvider;
    plans: IBillingPlan[];
    successUrl: string;
    cancelUrl: string;
    webhookSecret?: string;
    rateLimit?: {
        backend?: RateLimitBackendConfig;
    };
    notifications?: IBillingNotificationsConfig;
    pricing?: IBillingPricingConfig;
    wallet?: IBillingWalletConfig;
    resolveRecipient?: ResolveRecipient;
}

interface IBillingCreditPack {
    id: string;
    name: string;
    credits: bigint;
    priceAmount: bigint;
    currency?: string;
    priceId?: string;
    active?: boolean;
    metadata?: Record<string, unknown>;
}

interface IBillingPlan {
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

interface IBillingPlanDefaults {
    warnAt?: number;
    buffer?: number;
}

interface IBillingPlanPrice {
    lookupKey?: string;
    priceId?: string;
    amount?: bigint;
}

interface IBillingPlanWallet {
    currency?: string;
    precision?: number;
    grantAmount?: bigint;
    grantPeriod?: 'month' | 'week' | 'day';
    overdraftLimit?: bigint;
    rates?: Record<string, IWalletRate>;
    lowBalanceAt?: bigint;
    autoRecharge?: IBillingWalletAutoRecharge;
}

interface IBillingPricingConfig {
    hydration?: boolean;
    cacheTtlMs?: number;
    transferGraceMs?: number;
    maxStaleMs?: number;
}

interface IBillingWalletConfig {
    currency?: string;
    precision?: number;
    adminToken?: string;
    webhookSecret?: string;
    creditPacks?: IBillingCreditPack[];
}

interface IBillingWalletAutoRecharge {
    threshold: bigint;
    packId: string;
    cooldownSeconds?: number;
    maxConsecutiveFailures?: number;
}

interface IBillingRecipient {
    email?: string | null;
    phone?: string | null;
    deviceToken?: string | null;
}

type ResolveRecipient = (subscriberType: SubscriberType, subscriberId: string) => IBillingRecipient | null | Promise<IBillingRecipient | null>;

type RateLimitBackendConfig = 'memory' | 'db' | ICounterBackend;

interface IBillingNotificationsConfig {
    warnAt?: boolean;
    softHit?: boolean;
}

type BillingMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

type BillingEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

new MemoryCounterBackend(): MemoryCounterBackend
  .increment(key: string, windowMs: number | null, quantity?: number): Promise<number>
  .get(key: string, windowMs: number | null): Promise<number>

new DBCounterBackend(store: IStoreAdapter): DBCounterBackend
  .increment(key: string, windowMs: number | null, quantity?: number): Promise<number>
  .get(key: string, windowMs: number | null): Promise<number>

interface ICounterBackend {
    increment(key: string, windowMs: number | null, quantity?: number): Promise<number>;
    get(key: string, windowMs: number | null): Promise<number>;
}

const BILLING_INTERVAL: { readonly MONTH: "month"; readonly YEAR: "year"; }

const BILLING_INTERVALS: readonly ["month", "year"]

function isBillingInterval(value: unknown): value is "month" | "year"

const WALLET_LEDGER_TYPES: readonly ["purchase", "grant", "usage", "refund", "adjustment"]

type BillingInterval = (typeof BILLING_INTERVALS)[number];

type WalletLedgerType = (typeof WALLET_LEDGER_TYPES)[number];

interface IBillingProvider {
    name: string;
    createCustomer(opts: {
        email: string;
        subscriberType: SubscriberType;
        subscriberId: string;
        userId: string;
    }): Promise<{
        customerId: string;
    }>;
    createCheckoutSession(opts: {
        customerId: string;
        priceId: string;
        subscriberType: SubscriberType;
        subscriberId: string;
        trialDays?: number;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{
        url: string;
    }>;
    createPaymentCheckoutSession?(opts: {
        customerId: string;
        amount: bigint;
        currency: string;
        name: string;
        quantity?: number;
        priceId?: string;
        savePaymentMethod?: boolean;
        metadata: Record<string, string>;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{
        url: string;
        sessionId: string;
    }>;
    chargeOffSession?(opts: {
        customerId: string;
        amount: bigint;
        currency: string;
        idempotencyKey: string;
        metadata: Record<string, string>;
    }): Promise<{
        providerTxId: string | null;
        status: 'succeeded' | 'requires_action' | 'failed' | 'unknown';
    }>;
    resolvePriceById(priceId: string): Promise<IResolvedPrice | null>;
    resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>;
    updateSubscription(opts: {
        subscriptionId: string;
        priceId: string;
    }): Promise<{
        status: string;
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
    }>;
    cancelSubscription?(opts: {
        subscriptionId: string;
        atPeriodEnd: boolean;
    }): Promise<ISubscriptionChange>;
    reactivateSubscription?(opts: {
        subscriptionId: string;
    }): Promise<ISubscriptionChange>;
    createPortalSession(opts: {
        customerId: string;
        returnUrl: string;
    }): Promise<{
        url: string;
    }>;
    constructEvent(opts: {
        payload: string;
        signature: string;
        secret: string;
    }): Promise<IBillingEvent>;
}

interface IBillingEvent {
    type: string;
    subscription: INormalizedSubscription | null;
    payment?: INormalizedPayment | null;
    reversal?: INormalizedReversal | null;
    invoice?: INormalizedInvoice | null;
    paymentFailure?: INormalizedPaymentFailure | null;
}

interface INormalizedPayment {
    sessionId: string;
    providerTxId: string | null;
    customerId: string | null;
    amountTotal: bigint | null;
    currency: string | null;
    paymentStatus: string | null;
    metadata: Record<string, string>;
}

interface INormalizedReversal {
    kind: 'refund' | 'dispute';
    id: string;
    providerTxId: string | null;
    chargeId: string | null;
    amount: bigint | null;
    currency: string | null;
    reason: string | null;
    status: string | null;
    metadata: Record<string, string>;
}

interface INormalizedInvoice {
    id: string;
    status: 'paid' | 'payment_failed';
    amount: bigint | null;
    currency: string | null;
    providerTxId: string | null;
    providerSubscriptionId: string | null;
    providerCustomerId: string | null;
    metadata: Record<string, string>;
}

interface INormalizedPaymentFailure {
    sessionId: string | null;
    providerTxId: string | null;
    amount: bigint | null;
    currency: string | null;
    reason: string | null;
    metadata: Record<string, string>;
}

interface IResolvedPrice {
    priceId: string;
    lookupKey: string | null;
    unitAmount: bigint;
    currency: string;
    interval: BillingInterval;
    nickname: string | null;
    productId: string;
    active: boolean;
}

interface ISubscriptionChange {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
}

interface IPlan {
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

interface ISubscription {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: string;
    interval: BillingInterval;
    status: SubscriptionStatus;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
    createdAt: string;
}

interface IWalletBalance {
    balance: bigint;
    version: number;
    updatedAt: string | null;
}

interface IWalletContext {
    balance: bigint;
    currency: string;
    precision: number;
    overdraftLimit: bigint;
    rates: Record<string, IWalletRate>;
}

interface IWalletLedgerEntry {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    currency: string;
    type: WalletLedgerType;
    amount: bigint;
    balanceAfter: bigint;
    description: string | null;
    idempotencyKey: string;
    metadata: Record<string, unknown>;
    providerTxId: string | null;
    createdAt: string;
}

interface IWalletRate {
    cost: bigint;
    unit?: string;
}

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused';

type PolicyEntry = {
    enabled: boolean;
} | {
    limit: number | null;
    buffer?: number;
    warnAt?: number;
    window?: string;
    unit?: string;
};

type LimitStatus = 'ok' | 'warning' | 'over_limit' | 'blocked';

type IPolicyStatus = {
    type: 'feature';
    enabled: boolean;
} | {
    type: 'counter';
    limit: number | null;
    used: number;
    status: LimitStatus;
    resetsAt: string | null;
};

interface IBillingContext {
    subscriber: {
        type: SubscriberType;
        id: string;
    };
    plan: string;
    active: boolean;
    statuses: Record<string, IPolicyStatus>;
    wallet?: IWalletContext;
}

interface IPlanDTO {
    id: string;
    planId: string;
    name: string;
    description: string;
    tier: number;
    seats: number | null;
    trialDays: number;
    pricing: {
        monthly: number;
        yearly: number;
        currency: string;
    };
    pricingStale?: boolean;
    features: IPlanFeature[];
    metadata: Record<string, unknown>;
}

interface ISubscriptionDTO {
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

interface IWalletDTO {
    balance: string;
    currency: string;
    precision: number;
}

interface IWalletTransactionDTO {
    id: string;
    type: WalletLedgerType;
    amount: string;
    balanceAfter: string;
    currency: string;
    description: string | null;
    providerTxId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

function toPlanDTO(plan: IPlan): IPlanDTO

function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO

function toWalletDTO(balance: bigint, currency: string, precision: number): IWalletDTO

function toWalletTransactionDTO(entry: IWalletLedgerEntry): IWalletTransactionDTO

function creditWallet(opts: IWalletSubscriber & { amount: bigint; idempotencyKey: string; type?: "purchase" | "grant" | "usage" | "refund" | "adjustment"; description?: string; metadata?: Record<...>; providerTxId?: string; }, store: IStoreAdapter): Promise<...>

function debitWallet(opts: IWalletSubscriber & { amount: bigint; idempotencyKey: string; type?: "purchase" | "grant" | "usage" | "refund" | "adjustment"; overdraftLimit?: bigint; description?: string; metadata?: Record<...>; }, store: IStoreAdapter): Promise<...>

function reverseWallet(opts: IWalletSubscriber & { amount: bigint; idempotencyKey: string; providerTxId?: string; capToProviderTxId?: bigint; description?: string; metadata?: Record<string, unknown>; }, store: IStoreAdapter): Promise<...>

function findPurchaseByProviderTxId(providerTxId: string, store: IStoreAdapter): Promise<IWalletPurchaseRow | null>

function sumReversedCreditsByProviderTxId(providerTxId: string, store: IStoreAdapter): Promise<bigint>

function findLedgerAmountByKey(idempotencyKey: string, store: IStoreAdapter): Promise<bigint | null>

function getWalletBalance(sub: IWalletSubscriber, store: IStoreAdapter): Promise<IWalletBalance>

function getWalletLedger(opts: IWalletSubscriber & { limit?: number; cursor?: { createdAt: string; id: string; }; }, store: IStoreAdapter): Promise<IWalletLedgerPage>

function ensurePeriodicGrant(opts: IWalletSubscriber & { amount: bigint; period: string; description?: string; }, store: IStoreAdapter): Promise<IGrantResult>

function currentGrantPeriod(period: "month" | "week" | "day", now?: Date): string

function resolvePlanWallet(plan: IBillingPlan, config: IBillingConfig): IResolvedPlanWallet | null

function encodeLedgerCursor(createdAt: string, id: string): string

function decodeLedgerCursor(cursor: string): { createdAt: string; id: string; } | null

interface IWalletSubscriber {
    subscriberType: SubscriberType;
    subscriberId: string;
    currency: string;
}

interface IWalletMutationResult {
    balance: bigint;
    duplicate: boolean;
}

interface IWalletReversalResult extends IWalletMutationResult {
    reversed: bigint;
}

interface IWalletPurchaseRow {
    subscriberType: SubscriberType;
    subscriberId: string;
    currency: string;
    credits: bigint;
    metadata: Record<string, unknown>;
}

interface IWalletLedgerPage {
    entries: IWalletLedgerEntry[];
    nextCursor: string | null;
}

interface IGrantResult {
    granted: boolean;
    balance: bigint | null;
}

interface IResolvedPlanWallet {
    currency: string;
    precision: number;
    overdraftLimit: bigint;
    grantAmount: bigint | null;
    grantPeriod: 'month' | 'week' | 'day';
    rates: Record<string, IWalletRate>;
    lowBalanceAt: bigint | null;
    autoRecharge: IBillingWalletAutoRecharge | null;
}

new InsufficientFundsError(available: bigint, required: bigint, currency: string): InsufficientFundsError
  .available: bigint
  .required: bigint
  .currency: string
  .name: string
  .message: string
  .stack: string
  .cause: unknown

new DuplicateTransactionError(idempotencyKey: string): DuplicateTransactionError
  .idempotencyKey: string
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function recordUsage(opts: { subscriberType: SubscriberType; subscriberId: string; metric: string; quantity: number; }, store: IStoreAdapter): Promise<void>

function getUsage(subscriberType: SubscriberType, subscriberId: string, metric: string, since: Date, store: IStoreAdapter): Promise<number>

function getPlans(config: IBillingConfig): IBillingPlan[]

function getPlanByName(name: string, config: IBillingConfig): IBillingPlan | null

function getDBPlans(store: IStoreAdapter): Promise<IPlan[]>

function getPlanById(id: string, store: IStoreAdapter): Promise<IPlan | null>

function createPlan(data: { name: string; description?: string | null; tier?: number; seats?: number | null; trialDays?: number; features?: unknown; metadata?: unknown; monthlyAmount?: number | null; monthlyPriceId?: string | null; yearlyAmount?: number | null; yearlyPriceId?: string | null; }, store: IStoreAdapter): Promise<...>

function updatePlan(id: string, data: Partial<Omit<IPlan, "id">>, store: IStoreAdapter): Promise<IPlan | null>

function deletePlan(id: string, store: IStoreAdapter): Promise<boolean>

function getSubscription(subscriberType: SubscriberType, subscriberId: string, store: IStoreAdapter): Promise<ISubscription | null>

function getSubscriberByProviderSubscriptionId(providerSubscriptionId: string, store: IStoreAdapter): Promise<{ subscriberType: SubscriberType; subscriberId: string; } | null>

function maybeAutoRecharge(args: { store: IStoreAdapter; config: IBillingConfig; bus: EventBus | undefined; subscriberType: SubscriberType; subscriberId: string; balance: bigint; planWallet: IResolvedPlanWallet; }): Promise<...>

function upsertWalletCustomer(key: IWalletCustomerKey & { providerCustomerId: string; rearm: boolean; }, store: IStoreAdapter): Promise<void>

function claimAutoRecharge(key: IWalletCustomerKey & { cooldownSeconds: number; }, store: IStoreAdapter): Promise<IAutoRechargeClaim | null>

function recordRechargeSuccess(key: IWalletCustomerKey, store: IStoreAdapter): Promise<void>

function recordRechargeFailure(key: IWalletCustomerKey & { maxConsecutiveFailures: number; }, store: IStoreAdapter): Promise<{ disabled: boolean; }>

interface IWalletCustomerKey {
    subscriberType: SubscriberType;
    subscriberId: string;
    provider: string;
}

interface IAutoRechargeClaim {
    providerCustomerId: string;
    claimedAt: string;
    pendingKey: string | null;
}

namespace schemas — exports: cancelSubscriptionSchema, checkoutSchema, createPlanSchema, grantWalletSchema, recordUsageSchema, updatePlanSchema, walletCheckoutSchema
```
