<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-admin — signatures

## @fonderie/vue-admin

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
    deletion?: IAdminDeletionDTO | null;
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
  .cancelUserDeletion(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .holdUserDeletion(id: string, reason: string): Promise<IApiResponse<IAdminUserDTO>>
  .liftUserDeletionHold(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .eraseUserNow(id: string): Promise<IApiResponse<IAdminErasureDTO>>
  .listErasures(query?: IAdminErasuresQuery | undefined): Promise<IApiResponse<IAdminErasurePageResult>>
  .exportErasures(): Promise<IApiResponse<IAdminErasureExport>>

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

function useAttention(client: AdminClient): { attention: Ref<{ generatedAt: string; ok: boolean; items: { source: string; severity: "error" | "advice"; message: string; reason?: string; domain?: string; metadata?: Record<...>; }[]; } | null, IAdminAttention | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useManifest(client: AdminClient): { manifest: Ref<{ generatedAt: string; env: string; admin: { version: string; log: boolean; host: string[] | null; }; modules: { name: string; version: string | null; readiness: { ...; }; describesAdmin: boolean; }[]; readiness: { ...; }; routes: { ...; }[]; } | null, IAdminManifest | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useDoctor(client: AdminClient): { report: Ref<{ generatedAt: string; ok: boolean; checks: { name: string; module: string; ok: boolean; findings: string[]; details?: { severity: "error" | "advice"; message: string; reason?: string; domain?: string; metadata?: Record<...>; }[]; skipped?: string; skippedDetail?: { ...; }; durationMs: number; }[]; } | null, IAdminDoctorReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminEnvironment(client: AdminClient): { report: Ref<{ generatedAt: string; readiness: { ok: boolean; problems: { module: string; severity: "error" | "warning"; message: string; reason?: string; domain?: string; metadata?: Record<...>; }[]; }; modules: { ...; }[]; env: { ...; }[]; } | null, IAdminEnvironmentReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminRoutes(client: AdminClient): { report: Ref<{ generatedAt: string; routes: { method: string; path: string; module?: string; guard: AdminRouteGuard; }[]; } | null, IAdminRoutesReport | { ...; } | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminTokens(client: AdminClient): { report: Ref<{ generatedAt: string; admin: { ok: boolean; problems: { module: string; severity: "error" | "warning"; message: string; reason?: string; domain?: string; metadata?: Record<...>; }[]; }; legacy: { ...; }[]; issued: { ...; }[] | null; } | null, IAdminTokensReport | ... 1 more ... | null>; ... 4 more ...; revoke: (id: string) => Promise<...>; }

function useAdminSession(client: AdminClient): { session: Ref<{ state: AdminSessionState; operator: { id: string; email: string; name: string | null; scopes: AdminScope[]; ... 6 more ...; disabledAt: string | null; } | null; claimable?: boolean; stepUpFresh?: boolean; backupCodes?: string[]; backupCodesLeft?: number; } | null, IAdminSession | ... 1 more ... | null>; ... 11 more ...; redeemLink: (input: { ...; }) => Promise<...>; }

function useAdminOperators(client: AdminClient): { report: Ref<{ operators: { id: string; email: string; name: string | null; scopes: AdminScope[]; enrolled: boolean; backupCodesLeft: number; ... 4 more ...; disabledAt: string | null; }[]; links: { ...; }[]; } | null, IAdminOperatorsReport | ... 1 more ... | null>; ... 6 more ...; revokeLink: (id: string) => Promise<...>; }

function useAdminMigrations(client: AdminClient): { report: Ref<{ everApplied: boolean; modules: { name: string; pending: { file: string; impact: MigrationImpact; destructive: string[]; }[]; blockedBy: string | null; appliable: boolean; }[]; } | null, IAdminMigrationsReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; apply: (module: string, expect: readonly string[]) => Promise<...>; }

function useAdminLog(client: AdminClient, query?: Pick<IAdminLogQuery, "limit">): { entries: Ref<{ id: string; at: string; actor: string; method: string; path: string; route: string; ... 4 more ...; clientIp: string | null; }[], IAdminLogEntry[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }

function useAdminUser(client: AuthAdminClient, by: { email?: Ref<string, string>; id?: Ref<string, string>; }): { user: Ref<{ deletedAt: string | null; deletion?: { requestedAt: string; deleteOn: string; channel: string | null; remindedAt: string | null; hold: { ...; } | null; } | null; ... 18 more ...; updatedAt: string; } | null, IAdminUserDTO | ... 1 more ... | null>; ... 9 more ...; eraseNow(): Promise<...>; }

function useAdminUsers(client: AuthAdminClient, query?: Omit<IAdminUsersQuery, "cursor">): { users: Ref<{ deletedAt: string | null; deletion?: { requestedAt: string; deleteOn: string; channel: string | null; remindedAt: string | null; hold: { ...; } | null; } | null; ... 18 more ...; updatedAt: string; }[], IAdminUserDTO[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }

function useAdminErasures(client: AuthAdminClient, query?: Omit<IAdminErasuresQuery, "cursor">): { erasures: Ref<{ id: string; userId: string; emailHash: string | null; ... 5 more ...; outcomes: { ...; }[]; }[], IAdminErasureDTO[] | { ...; }[]>; ... 5 more ...; exportAll: () => Promise<...>; }

function useAdminUserSessions(client: AuthAdminClient, userId: Ref<string | null, string | null>): { sessions: Ref<{ id: string; current: boolean; ipAddress: string | null; userAgent: string | null; location: { ...; } | null; createdAt: string; expiresAt: string; }[], ISessionDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminLoginHistory(client: AuthAdminClient, userId: Ref<string | null, string | null>, query?: { limit?: number; }): { events: Ref<{ id: string; method: string; outcome: string; failureReason: string | null; ipAddress: string | null; userAgent: string | null; location: { ...; } | null; createdAt: string; }[], ILoginEventDTO[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }

function useAdminCatalog(client: BillingAdminClient): { catalog: Ref<{ configured: unknown[]; stored: { id: string; planId: string; name: string; description: string; tier: number; seats: number | null; ... 4 more ...; metadata: Record<...>; }[]; } | null, IAdminCatalog | ... 1 more ... | null>; ... 5 more ...; deletePlan: (planId: string) => Promise<...>; }

function useAdminSubscriber(client: BillingAdminClient, subscriber: Ref<{ type: SubscriberType; id: string; } | null, { type: SubscriberType; id: string; } | null>, options?: { ...; }): { ...; }

function useAdminSubscribers(client: BillingAdminClient, query?: Omit<IAdminSubscriptionsQuery, "cursor">): { subscriptions: Ref<{ id: string; subscriberType: SubscriberType; ... 10 more ...; createdAt: string; }[], IAdminSubscriptionDTO[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }

function useAdminAudit(client: AuditAdminClient, query: Ref<Omit<IAdminAuditQuery, "cursor">, Omit<IAdminAuditQuery, "cursor">>): { ...; }
```
