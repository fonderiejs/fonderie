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
  .createPortalSession(opts: { customerId: string; returnUrl: string; }): Promise<{ url: string; }>
  .constructEvent(opts: { payload: string; signature: string; secret: string; }): Promise<IBillingEvent>

function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware

function withBilling(store: IStoreAdapter, config: IBillingConfig, backend: ICounterBackend): Middleware

function hasFeature(ctx: IFonderieContext, key: string): boolean

function getPlanLimit(ctx: IFonderieContext, key: string): number | null

function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null

function requireFeature(key: string): Middleware

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
    metadata?: Record<string, unknown>;
}

interface IBillingPlanDefaults {
    warnAt?: number;
    buffer?: number;
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

function toPlanDTO(plan: IPlan): IPlanDTO

function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO

function toUsageRecordDTO(record: IUsageRecord): IUsageRecordDTO

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

namespace schemas — exports: checkoutSchema, createPlanSchema, recordUsageSchema, updatePlanSchema
```
