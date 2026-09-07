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
  .cancelSubscription(input?: ICancelSubscriptionInput | undefined): Promise<IApiResponse<ISubscriptionChangeResult>>
  .reactivateSubscription(): Promise<IApiResponse<ISubscriptionChangeResult>>
  .createCheckoutSession(input: ICheckoutInput): Promise<IApiResponse<ICheckoutUrlResult>>
  .createPortalSession(): Promise<IApiResponse<IPortalUrlResult>>
  .recordUsage(input: IRecordUsageInput): Promise<IApiResponse<undefined>>
  .getUsage(metric: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IUsageResult>>
  .getWallet(opts?: IReadOptions | undefined): Promise<IApiResponse<IWalletResult>>
  .setWalletPreferences(input: IWalletPreferencesInput): Promise<IApiResponse<IWalletResult>>
  .createWalletCheckout(input: IWalletCheckoutInput): Promise<IApiResponse<ICheckoutUrlResult>>
  .getWalletTransactions(opts?: (IReadOptions & { cursor?: string; limit?: number; }) | undefined): Promise<IApiResponse<IWalletTransactionsResult>>
  .getPaymentMethod(opts?: IReadOptions | undefined): Promise<IApiResponse<IPaymentMethodResult>>
  .setupPaymentMethod(): Promise<IApiResponse<ISetupIntentResult>>
  .savePaymentMethod(input: ISavePaymentMethodInput): Promise<IApiResponse<IPaymentMethodResult>>
  .removePaymentMethod(): Promise<IApiResponse<IPaymentMethodResult>>
  .listInvoices(opts?: IReadOptions | undefined): Promise<IApiResponse<IInvoicesResult>>

interface ICancelSubscriptionInput {
    atPeriodEnd?: boolean;
}

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

interface IInvoiceDTO {
    id: string;
    number: string | null;
    amountDue: string;
    amountPaid: string;
    currency: string;
    status: string;
    created: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
}

interface IPaymentMethodDTO {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
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

interface ISubscriptionChangeResult {
    atPeriodEnd: boolean;
    status: string;
    currentPeriodEnd: string | null;
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

interface IWalletCheckoutInput {
    packId: string;
}

interface IWalletDTO {
    balance: string;
    currency: string;
    precision: number;
    granted?: string;
    purchased?: string;
    spendPurchased?: boolean;
    grantedExpiresAt?: string | null;
}

interface IWalletTransactionDTO {
    id: string;
    type: string;
    amount: string;
    balanceAfter: string;
    currency: string;
    description: string | null;
    providerTxId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}

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

interface IUseCancelSubscriptionReturn {
    cancel: (input?: ICancelSubscriptionInput) => Promise<ISubscriptionChangeResult>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseCheckoutReturn {
    checkout: (input: ICheckoutInput) => Promise<string>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseInvoicesReturn {
    invoices: Ref<IInvoiceDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUsePaymentMethodReturn {
    paymentMethod: Ref<IPaymentMethodDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
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

interface IUseReactivateSubscriptionReturn {
    reactivate: () => Promise<ISubscriptionChangeResult>;
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

interface IUseWalletCheckoutReturn {
    checkout: (input: IWalletCheckoutInput) => Promise<string>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseWalletPreferencesReturn {
    spendPurchased: Ref<boolean | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    setSpendPurchased: (spendPurchased: boolean) => Promise<void>;
}

interface IUseWalletReturn {
    wallet: Ref<IWalletDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseWalletTransactionsReturn {
    transactions: Ref<IWalletTransactionDTO[]>;
    nextCursor: Ref<string | null>;
    hasMore: ComputedRef<boolean>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    loadMore: () => Promise<void>;
}

function useBillingPortal(client?: BillingClient | undefined): IUseBillingPortalReturn

function useCancelSubscription(client?: BillingClient | undefined): IUseCancelSubscriptionReturn

function useCheckout(client?: BillingClient | undefined): IUseCheckoutReturn

function useInvoices(client?: BillingClient | undefined): IUseInvoicesReturn

function usePaymentMethod(client?: BillingClient | undefined): IUsePaymentMethodReturn

function usePlan(planId: MaybeRefOrGetter<string>): IUsePlanReturn

function usePlans(client?: BillingClient | undefined): IUsePlansReturn

function useReactivateSubscription(client?: BillingClient | undefined): IUseReactivateSubscriptionReturn

function useSubscription(client?: BillingClient | undefined): IUseSubscriptionReturn

function useUsage(metric: MaybeRefOrGetter<string>): IUseUsageReturn

function useWallet(client?: BillingClient | undefined): IUseWalletReturn

function useWalletCheckout(client?: BillingClient | undefined): IUseWalletCheckoutReturn

function useWalletPreferences(client?: BillingClient | undefined): IUseWalletPreferencesReturn

function useWalletTransactions(client?: BillingClient | undefined): IUseWalletTransactionsReturn
```
