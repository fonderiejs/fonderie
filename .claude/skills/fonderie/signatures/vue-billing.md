<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-billing — signatures

## @fonderie/vue-billing

```ts
new BillingClient(http: HttpClient, tokens: TokenStore): BillingClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listPlans(opts?: IReadOptions | undefined): Promise<IApiResponse<IPlanListResult>>
  .getPlan(planId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IPlanResult>>
  .createPlan(input: ICreatePlanInput): Promise<IApiResponse<IPlanResult>>
  .updatePlan(planId: string, input: Partial<ICreatePlanInput>): Promise<IApiResponse<IPlanResult>>
  .deletePlan(planId: string): Promise<IApiResponse<undefined>>
  .getSubscription(opts?: IReadOptions | undefined): Promise<IApiResponse<ISubscriptionResult>>
  .createCheckoutSession(input: ICheckoutInput): Promise<IApiResponse<ICheckoutUrlResult>>
  .createPortalSession(): Promise<IApiResponse<IPortalUrlResult>>
  .recordUsage(input: IRecordUsageInput): Promise<IApiResponse<undefined>>
  .getUsage(metric: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IUsageResult>>

interface ICheckoutInput {
    plan: string;
    interval?: 'month' | 'year';
}

interface ICreatePlanInput {
    name: string;
    description?: string | null;
    tier?: number;
    seats?: number | null;
    trialDays?: number;
    monthlyAmount?: number | null;
    monthlyPriceId?: string | null;
    yearlyAmount?: number | null;
    yearlyPriceId?: string | null;
    features?: unknown;
    metadata?: unknown;
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

interface IPlanFeature {
    name: string;
    description: string;
    enabled: boolean;
    limit?: number;
}

interface IRecordUsageInput {
    metric: string;
    quantity?: number;
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

type IUpdatePlanInput = Partial<ICreatePlanInput>;

type SubscriberType = 'user' | 'workspace';

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IUseBillingPortalReturn {
    openPortal: () => Promise<string>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseCheckoutReturn {
    checkout: (input: ICheckoutInput) => Promise<string>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUsePlanAdminReturn {
    createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
    updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
    deletePlan: (planId: string) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUsePlanReturn {
    plan: Ref<IPlanDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUsePlansReturn {
    plans: Ref<IPlanDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
    updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
    deletePlan: (planId: string) => Promise<void>;
}

interface IUseRecordUsageReturn {
    recordUsage: (input: IRecordUsageInput) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseSubscriptionReturn {
    subscription: Ref<ISubscriptionDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseUsageReturn {
    total: Ref<number | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    recordUsage: (input: IRecordUsageInput) => Promise<void>;
}

function useBillingPortal(client?: BillingClient | undefined): IUseBillingPortalReturn

function useCheckout(client?: BillingClient | undefined): IUseCheckoutReturn

function usePlan(planId: MaybeRefOrGetter<string>): IUsePlanReturn

function usePlanAdmin(client?: BillingClient | undefined): IUsePlanAdminReturn

function usePlans(client?: BillingClient | undefined): IUsePlansReturn

function useRecordUsage(client?: BillingClient | undefined): IUseRecordUsageReturn

function useSubscription(client?: BillingClient | undefined): IUseSubscriptionReturn

function useUsage(metric: MaybeRefOrGetter<string>): IUseUsageReturn
```
