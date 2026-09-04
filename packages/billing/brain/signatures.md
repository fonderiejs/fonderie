<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/billing — signatures

## @fonderie/billing

Subpath exports: `@fonderie/billing/types`, `@fonderie/billing/middleware`, `@fonderie/billing/migrations`

```ts
new BillingModule(store: IStoreAdapter, config: IBillingConfig): BillingModule
  .name: "@fonderie/billing"
  .deps: string[]
  .install(app: IFonderieApp): Promise<void>

new StripeProvider(secretKey: string, webhookSecret?: string | undefined): StripeProvider
  .name: "stripe"
  .createCustomer(opts: { email: string; subscriberType: SubscriberType; subscriberId: string; userId: string; }): Promise<{ customerId: string; }>
  .createCheckoutSession(opts: { customerId: string; priceId: string; subscriberType: SubscriberType; subscriberId: string; trialDays?: number; successUrl: string; cancelUrl: string; }): Promise<{ url: string; }>
  .createPaymentCheckoutSession(opts: { customerId: string; amount: bigint; currency: string; name: string; quantity?: number; priceId?: string; metadata: Record<string, string>; successUrl: string; cancelUrl: string; }): Promise<...>
  .resolvePriceById(priceId: string): Promise<IResolvedPrice | null>
  .resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>
  .updateSubscription(opts: { subscriptionId: string; priceId: string; }): Promise<{ status: string; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; }>
  .createPortalSession(opts: { customerId: string; returnUrl: string; }): Promise<{ url: string; }>
  .constructEvent(opts: { payload: string; signature: string; secret: string; }): Promise<IBillingEvent>

function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware

function withBilling(store: IStoreAdapter, config: IBillingConfig, backend: ICounterBackend): Middleware

function hasFeature(ctx: IFonderieContext, key: string): boolean

function getPlanLimit(ctx: IFonderieContext, key: string): number | null

function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null

function requireFeature(key: string): Middleware

function getWalletStatus(ctx: IFonderieContext): IWalletContext | null

function getWalletRate(ctx: IFonderieContext, metric: string): bigint | null

function requireWalletBalance(metric: string): Middleware

function debitWalletForMetric(ctx: IFonderieContext, metric: string, opts: { idempotencyKey: string; quantity?: number; description?: string; metadata?: Record<string, unknown>; }, store: IStoreAdapter): Promise<...>

function insufficientCreditsResponse(err: InsufficientFundsError, metric?: string | undefined): Response

const MESSAGE_KEYS: { readonly limitWarning: "billing.limit-warning"; readonly limitReached: "billing.limit-reached"; readonly limitBlocked: "billing.limit-blocked"; }

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

type RateLimitBackendConfig = 'memory' | 'db' | ICounterBackend;

interface IBillingNotificationsConfig {
    warnAt?: boolean;
    softHit?: boolean;
}

type BillingMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

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

const WALLET_LEDGER_TYPES: readonly ["purchase", "grant", "usage", "refund", "adjustment"]

type BillingInterval = (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];

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
        metadata: Record<string, string>;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{
        url: string;
        sessionId: string;
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
}

interface INormalizedPayment {
    sessionId: string;
    providerTxId: string | null;
    amountTotal: bigint | null;
    currency: string | null;
    paymentStatus: string | null;
    metadata: Record<string, string>;
}

interface IResolvedPrice {
    priceId: string;
    lookupKey: string | null;
    unitAmount: bigint;
    currency: string;
    interval: 'month' | 'year';
    nickname: string | null;
    productId: string;
    active: boolean;
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

interface IUsageRecord {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    metric: string;
    quantity: number;
    recordedAt: string;
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

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'paused';

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

interface IUsageRecordDTO {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    metric: string;
    quantity: number;
    recordedAt: string;
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

function toUsageRecordDTO(record: IUsageRecord): IUsageRecordDTO

function toWalletDTO(balance: bigint, currency: string, precision: number): IWalletDTO

function toWalletTransactionDTO(entry: IWalletLedgerEntry): IWalletTransactionDTO

function creditWallet(opts: IWalletSubscriber & { amount: bigint; idempotencyKey: string; type?: "purchase" | "grant" | "usage" | "refund" | "adjustment"; description?: string; metadata?: Record<...>; providerTxId?: string; }, store: IStoreAdapter): Promise<...>

function debitWallet(opts: IWalletSubscriber & { amount: bigint; idempotencyKey: string; type?: "purchase" | "grant" | "usage" | "refund" | "adjustment"; overdraftLimit?: bigint; description?: string; metadata?: Record<...>; }, store: IStoreAdapter): Promise<...>

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

namespace schemas — exports: checkoutSchema, createPlanSchema, grantWalletSchema, recordUsageSchema, updatePlanSchema, walletCheckoutSchema
```
