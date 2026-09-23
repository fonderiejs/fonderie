<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-admin — signatures

## @fonderie/react-admin

```ts
type AdminRouteGuard = 'admin' | 'probe' | 'app';

interface IAdminAttention {
    generatedAt: string;
    ok: boolean;
    items: IAdminAttentionItem[];
}

interface IAdminAttentionItem {
    source: string;
    severity: 'error' | 'advice';
    message: string;
}

interface IAdminCheckResult {
    name: string;
    module: string;
    ok: boolean;
    findings: string[];
    skipped?: string;
    durationMs: number;
}

interface IAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IAdminConfigReport {
    generatedAt: string;
    readiness: IAdminReadiness;
    modules: Array<{
        name: string;
        problems: IAdminReadinessProblem[];
    }>;
    env: Array<{
        name: string;
        set: boolean;
    }>;
}

interface IAdminDoctorReport {
    generatedAt: string;
    ok: boolean;
    checks: IAdminCheckResult[];
}

interface IAdminLogEntry {
    id: string;
    at: string;
    actor: string;
    method: string;
    path: string;
    route: string;
    module: string;
    status: number;
    durationMs: number;
    requestId: string | null;
    clientIp: string | null;
}

interface IAdminLogPage {
    entries: IAdminLogEntry[];
    next: string | null;
}

interface IAdminLogQuery {
    limit?: number;
    before?: string;
}

interface IAdminManifest {
    generatedAt: string;
    env: string;
    admin: {
        version: string;
        log: boolean;
        host: string[] | null;
    };
    modules: IAdminModuleEntry[];
    readiness: IAdminReadiness;
    routes: IAdminRouteEntry[];
}

interface IAdminModuleEntry {
    name: string;
    version: string | null;
    readiness: IAdminReadiness;
    describesAdmin: boolean;
}

interface IAdminReadiness {
    ok: boolean;
    problems: IAdminReadinessProblem[];
}

interface IAdminReadinessProblem {
    module: string;
    severity: 'error' | 'warning';
    message: string;
}

interface IAdminRouteEntry {
    method: string;
    path: string;
    module?: string;
}

interface IAdminRoutesReport {
    generatedAt: string;
    routes: Array<IAdminRouteEntry & {
        guard: AdminRouteGuard;
    }>;
}

interface IAdminTokensReport {
    generatedAt: string;
    admin: {
        ok: boolean;
        problems: IAdminReadinessProblem[];
    };
    legacy: Array<{
        module: string;
        set: boolean;
    }>;
    issued: IAdminTokenRecord[] | null;
}

interface IAdminUserDTO extends IUserDTO {
    deletedAt: string | null;
}

interface IAuthAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IAdminLoginHistoryQuery {
    limit?: number;
    cursor?: string;
}

interface ILoginEventDTO {
    id: string;
    method: string;
    outcome: string;
    failureReason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}

interface ILoginHistoryPageResult {
    events: ILoginEventDTO[];
    nextCursor: string | null;
}

interface ISessionDTO {
    id: string;
    current: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
}

interface IAdminCatalog {
    configured: unknown[];
    stored: IPlanDTO[];
}

interface IAdminSubscriptionDTO {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: string;
    interval: string;
    status: string;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
    createdAt: string;
}

interface IAdminWalletDTO extends IWalletDTO {
    version: number;
    updatedAt: string | null;
}

interface IAdminWalletLedgerPage {
    currency: string;
    entries: IWalletTransactionDTO[];
    nextCursor: string | null;
}

interface IAdminPlanInput {
    name?: string;
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

interface IAdminGrantInput {
    subscriberType: SubscriberType;
    subscriberId: string;
    amount: string | number;
    currency?: string;
    description?: string;
    idempotencyKey: string;
}

interface IBillingAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IAdminLedgerQuery {
    currency?: string;
    limit?: number;
    cursor?: string;
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

interface IAuditAdminClientOptions {
    baseUrl: string;
    adminToken: string;
    prefix?: string;
    actor?: string;
}

interface IAdminAuditQuery {
    workspaceId?: string;
    type?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

interface IAuditEventDTO {
    id: string;
    type: string;
    actorId: string | null;
    requestId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
}

interface IAuditPageResult {
    events: IAuditEventDTO[];
    nextCursor: string | null;
}

type AdminScope = 'read' | 'write' | 'secrets';

interface IAdminTokenRecord {
    id: string;
    name: string;
    scopes: AdminScope[];
    createdBy: string;
    createdAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
}

interface IAdminIssueTokenInput {
    name: string;
    scopes: AdminScope[];
    expiresInDays?: number;
}

interface IAdminIssuedToken extends IAdminTokenRecord {
    token: string;
}

new AdminClient(opts: IAdminClientOptions): AdminClient
  .attention(): Promise<IApiResponse<IAdminAttention>>
  .manifest(): Promise<IApiResponse<IAdminManifest>>
  .doctor(): Promise<IApiResponse<IAdminDoctorReport>>
  .config(): Promise<IApiResponse<IAdminConfigReport>>
  .routes(): Promise<IApiResponse<IAdminRoutesReport>>
  .tokens(): Promise<IApiResponse<IAdminTokensReport>>
  .adminLog(query?: IAdminLogQuery | undefined): Promise<IApiResponse<IAdminLogPage>>
  .issueToken(input: IAdminIssueTokenInput): Promise<IApiResponse<IAdminIssuedToken>>
  .revokeToken(id: string): Promise<IApiResponse<undefined>>

new AuthAdminClient(opts: IAuthAdminClientOptions): AuthAdminClient
  .findUser(email: string): Promise<IApiResponse<IAdminUserDTO>>
  .getUser(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .listUserSessions(id: string): Promise<IApiResponse<ISessionDTO[]>>
  .revokeUserSessions(id: string): Promise<IApiResponse<undefined>>
  .userLoginHistory(id: string, query?: IAdminLoginHistoryQuery | undefined): Promise<IApiResponse<ILoginHistoryPageResult>>
  .suspendUser(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .unsuspendUser(id: string): Promise<IApiResponse<IAdminUserDTO>>

new BillingAdminClient(opts: IBillingAdminClientOptions): BillingAdminClient
  .catalog(): Promise<IApiResponse<IAdminCatalog>>
  .createPlan(input: IAdminPlanInput & { name: string; }): Promise<IApiResponse<IPlanDTO>>
  .updatePlan(planId: string, input: IAdminPlanInput): Promise<IApiResponse<IPlanDTO>>
  .deletePlan(planId: string): Promise<IApiResponse<undefined>>
  .listSubscriptions(query?: IAdminSubscriptionsQuery | undefined): Promise<IApiResponse<IAdminSubscriptionPage>>
  .subscription(type: SubscriberType, id: string): Promise<IApiResponse<IAdminSubscriptionDTO>>
  .wallet(type: SubscriberType, id: string, currency?: string | undefined): Promise<IApiResponse<IAdminWalletDTO>>
  .walletLedger(type: SubscriberType, id: string, query?: IAdminLedgerQuery | undefined): Promise<IApiResponse<IAdminWalletLedgerPage>>
  .grant(input: IAdminGrantInput): Promise<IApiResponse<unknown>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown, requestId?: string | undefined): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .requestId: string | undefined
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IUseAttentionReturn {
    attention: IAdminAttention | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseManifestReturn {
    manifest: IAdminManifest | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseDoctorReturn {
    report: IAdminDoctorReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseAdminConfigReturn {
    report: IAdminConfigReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseAdminRoutesReturn {
    report: IAdminRoutesReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseAdminTokensReturn {
    report: IAdminTokensReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    issue: (input: IAdminIssueTokenInput) => Promise<IAdminIssuedToken>;
    revoke: (id: string) => Promise<void>;
}

interface IUseAdminLogReturn {
    entries: IAdminLogEntry[];
    hasMore: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IUseAdminUserReturn {
    user: IAdminUserDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    suspend: () => Promise<void>;
    unsuspend: () => Promise<void>;
    revokeSessions: () => Promise<void>;
}

interface IUseAdminUserSessionsReturn {
    sessions: ISessionDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseAdminLoginHistoryReturn {
    events: ILoginEventDTO[];
    hasMore: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IUseAdminCatalogReturn {
    catalog: IAdminCatalog | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    createPlan: (input: IAdminPlanInput & {
        name: string;
    }) => Promise<IPlanDTO>;
    updatePlan: (planId: string, input: IAdminPlanInput) => Promise<IPlanDTO>;
    deletePlan: (planId: string) => Promise<void>;
}

interface IUseAdminSubscriberReturn {
    subscription: IAdminSubscriptionDTO | null;
    wallet: IAdminWalletDTO | null;
    ledger: IWalletTransactionDTO[];
    hasMoreLedger: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMoreLedger: () => Promise<void>;
    grant: (input: Omit<IAdminGrantInput, 'subscriberType' | 'subscriberId'>) => Promise<void>;
}

interface IUseAdminSubscribersReturn {
    subscriptions: IAdminSubscriptionDTO[];
    hasMore: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IUseAdminAuditReturn {
    events: IAuditEventDTO[];
    hasMore: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
}

function useAttention(client: AdminClient): IUseAttentionReturn

function useManifest(client: AdminClient): IUseManifestReturn

function useDoctor(client: AdminClient): IUseDoctorReturn

function useAdminConfig(client: AdminClient): IUseAdminConfigReturn

function useAdminRoutes(client: AdminClient): IUseAdminRoutesReturn

function useAdminTokens(client: AdminClient): IUseAdminTokensReturn

function useAdminLog(client: AdminClient, query?: Pick<IAdminLogQuery, "limit">): IUseAdminLogReturn

function useAdminUser(client: AuthAdminClient, by: { email?: string; id?: string; }): IUseAdminUserReturn

function useAdminUserSessions(client: AuthAdminClient, userId: string | null): IUseAdminUserSessionsReturn

function useAdminLoginHistory(client: AuthAdminClient, userId: string | null, query?: { limit?: number; }): IUseAdminLoginHistoryReturn

function useAdminCatalog(client: BillingAdminClient): IUseAdminCatalogReturn

function useAdminSubscriber(client: BillingAdminClient, subscriber: { type: SubscriberType; id: string; } | null, options?: { currency?: string; limit?: number; }): IUseAdminSubscriberReturn

function useAdminSubscribers(client: BillingAdminClient, query?: Omit<IAdminSubscriptionsQuery, "cursor">): IUseAdminSubscribersReturn

function useAdminAudit(client: AuditAdminClient, query?: Omit<IAdminAuditQuery, "cursor">): IUseAdminAuditReturn
```
