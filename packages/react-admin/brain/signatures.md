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

interface IAdminAttentionItem extends IAdminReason {
    source: string;
    severity: 'error' | 'advice';
}

interface IAdminCheckResult {
    name: string;
    module: string;
    ok: boolean;
    findings: string[];
    details?: IAdminFinding[];
    skipped?: string;
    skippedDetail?: IAdminFinding;
    durationMs: number;
}

interface IAdminClientOptions {
    baseUrl: string;
    adminToken?: string;
    prefix?: string;
    actor?: string;
}

interface IAdminEnvironmentReport {
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

interface IAdminReadinessProblem extends IAdminReason {
    module: string;
    severity: 'error' | 'warning';
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

interface IAdminOperator {
    id: string;
    email: string;
    name: string | null;
    scopes: AdminScope[];
    enrolled: boolean;
    backupCodesLeft: number;
    locked: boolean;
    createdBy: string;
    createdAt: string;
    lastLoginAt: string | null;
    disabledAt: string | null;
}

interface IAdminOperatorLink {
    id: string;
    kind: 'invite' | 'recovery';
    email: string;
    scopes: AdminScope[];
    createdBy: string;
    createdAt: string;
    expiresAt: string;
}

interface IAdminOperatorsReport {
    operators: IAdminOperator[];
    links: IAdminOperatorLink[];
}

interface IAdminCreatedLink {
    id: string;
    email: string;
    scopes?: AdminScope[];
    expiresAt: string;
    token: string;
    url: string;
}

interface IAdminSession {
    state: AdminSessionState;
    operator: IAdminOperator | null;
    claimable?: boolean;
    stepUpFresh?: boolean;
    backupCodes?: string[];
    backupCodesLeft?: number;
}

interface IAdminEnrollment {
    secret: string;
    uri: string;
    account: string;
    issuer: string;
}

type IAdminSecondFactor = {
    code: string;
} | {
    backupCode: string;
};

type AdminSessionState = 'signed-out' | 'needs-2fa' | 'needs-enrollment' | 'signed-in';

interface IAdminMigrationsReport {
    everApplied: boolean;
    modules: IAdminMigrationModule[];
}

interface IAdminMigrationModule {
    name: string;
    pending: IAdminPendingMigration[];
    blockedBy: string | null;
    appliable: boolean;
}

interface IAdminPendingMigration {
    file: string;
    impact: MigrationImpact;
    destructive: string[];
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
    location: IRequestLocationDTO | null;
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
    location: IRequestLocationDTO | null;
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
  .environment(): Promise<IApiResponse<IAdminEnvironmentReport>>
  .routes(): Promise<IApiResponse<IAdminRoutesReport>>
  .tokens(): Promise<IApiResponse<IAdminTokensReport>>
  .adminLog(query?: IAdminLogQuery | undefined): Promise<IApiResponse<IAdminLogPage>>
  .issueToken(input: IAdminIssueTokenInput): Promise<IApiResponse<IAdminIssuedToken>>
  .revokeToken(id: string): Promise<IApiResponse<undefined>>
  .migrations(): Promise<IApiResponse<IAdminMigrationsReport>>
  .applyMigrations(module: string, expect: readonly string[]): Promise<IApiResponse<IAdminMigrationModule>>
  .session(): Promise<IApiResponse<IAdminSession>>
  .claim(input: { email: string; password: string; name?: string; }): Promise<IApiResponse<IAdminSession>>
  .login(input: { email: string; password: string; }): Promise<IApiResponse<IAdminSession>>
  .enrollment(): Promise<IApiResponse<IAdminEnrollment>>
  .confirmEnrollment(code: string): Promise<IApiResponse<IAdminSession>>
  .verify(factor: IAdminSecondFactor): Promise<IApiResponse<IAdminSession>>
  .stepUp(factor: IAdminSecondFactor): Promise<IApiResponse<{ stepUpFresh: boolean; backupCodesLeft?: number; }>>
  .logout(): Promise<IApiResponse<undefined>>
  .inspectLink(token: string): Promise<IApiResponse<{ kind: "invite" | "recovery"; email: string; }>>
  .redeemLink(input: { token: string; password: string; name?: string; }): Promise<IApiResponse<IAdminSession>>
  .operators(): Promise<IApiResponse<IAdminOperatorsReport>>
  .inviteOperator(input: { email: string; scopes: AdminScope[]; expiresInHours?: number; }): Promise<IApiResponse<IAdminCreatedLink>>
  .recoverOperator(id: string): Promise<IApiResponse<IAdminCreatedLink>>
  .updateOperator(id: string, input: { scopes?: AdminScope[]; name?: string; disabled?: boolean; }): Promise<IApiResponse<IAdminOperator>>
  .revokeOperatorLink(id: string): Promise<IApiResponse<undefined>>

new AuthAdminClient(opts: IAuthAdminClientOptions): AuthAdminClient
  .listUsers(query?: IAdminUsersQuery | undefined): Promise<IApiResponse<IAdminUserPageResult>>
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

interface IUseAdminEnvironmentReturn {
    report: IAdminEnvironmentReport | null;
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

interface IUseAdminMigrationsReturn {
    report: IAdminMigrationsReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    apply: (module: string, expect: readonly string[]) => Promise<IAdminMigrationModule>;
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

interface IUseAdminUsersReturn {
    users: IAdminUserDTO[];
    hasMore: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    loadMore: () => Promise<void>;
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

interface IUseAdminSessionReturn {
    session: IAdminSession | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    claim: (rootClient: AdminClient, input: {
        email: string;
        password: string;
        name?: string;
    }) => Promise<IAdminSession>;
    login: (input: {
        email: string;
        password: string;
    }) => Promise<IAdminSession>;
    enrollment: () => Promise<IAdminEnrollment>;
    confirmEnrollment: (code: string) => Promise<IAdminSession>;
    verify: (factor: IAdminSecondFactor) => Promise<IAdminSession>;
    stepUp: (factor: IAdminSecondFactor) => Promise<void>;
    logout: () => Promise<void>;
    inspectLink: (token: string) => Promise<{
        kind: 'invite' | 'recovery';
        email: string;
    }>;
    redeemLink: (input: {
        token: string;
        password: string;
        name?: string;
    }) => Promise<IAdminSession>;
}

interface IUseAdminOperatorsReturn {
    report: IAdminOperatorsReport | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    invite: (input: {
        email: string;
        scopes: AdminScope[];
        expiresInHours?: number;
    }) => Promise<IAdminCreatedLink>;
    recover: (id: string) => Promise<IAdminCreatedLink>;
    update: (id: string, input: {
        scopes?: AdminScope[];
        name?: string;
        disabled?: boolean;
    }) => Promise<IAdminOperator>;
    revokeLink: (id: string) => Promise<void>;
}

function useAttention(client: AdminClient): IUseAttentionReturn

function useManifest(client: AdminClient): IUseManifestReturn

function useDoctor(client: AdminClient): IUseDoctorReturn

function useAdminEnvironment(client: AdminClient): IUseAdminEnvironmentReturn

function useAdminRoutes(client: AdminClient): IUseAdminRoutesReturn

function useAdminTokens(client: AdminClient): IUseAdminTokensReturn

function useAdminMigrations(client: AdminClient): IUseAdminMigrationsReturn

function useAdminLog(client: AdminClient, query?: Pick<IAdminLogQuery, "limit">): IUseAdminLogReturn

function useAdminUser(client: AuthAdminClient, by: { email?: string; id?: string; }): IUseAdminUserReturn

function useAdminUsers(client: AuthAdminClient, query?: Omit<IAdminUsersQuery, "cursor">): IUseAdminUsersReturn

function useAdminUserSessions(client: AuthAdminClient, userId: string | null): IUseAdminUserSessionsReturn

function useAdminLoginHistory(client: AuthAdminClient, userId: string | null, query?: { limit?: number; }): IUseAdminLoginHistoryReturn

function useAdminCatalog(client: BillingAdminClient): IUseAdminCatalogReturn

function useAdminSubscriber(client: BillingAdminClient, subscriber: { type: SubscriberType; id: string; } | null, options?: { currency?: string; limit?: number; }): IUseAdminSubscriberReturn

function useAdminSubscribers(client: BillingAdminClient, query?: Omit<IAdminSubscriptionsQuery, "cursor">): IUseAdminSubscribersReturn

function useAdminAudit(client: AuditAdminClient, query?: Omit<IAdminAuditQuery, "cursor">): IUseAdminAuditReturn

function useAdminSession(client: AdminClient): IUseAdminSessionReturn

function useAdminOperators(client: AdminClient): IUseAdminOperatorsReturn
```
