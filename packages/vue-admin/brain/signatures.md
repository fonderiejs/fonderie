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

new AdminClient(opts: IAdminClientOptions): AdminClient
  .attention(): Promise<IApiResponse<IAdminAttention>>
  .manifest(): Promise<IApiResponse<IAdminManifest>>
  .doctor(): Promise<IApiResponse<IAdminDoctorReport>>
  .config(): Promise<IApiResponse<IAdminConfigReport>>
  .routes(): Promise<IApiResponse<IAdminRoutesReport>>
  .tokens(): Promise<IApiResponse<IAdminTokensReport>>
  .adminLog(query?: IAdminLogQuery | undefined): Promise<IApiResponse<IAdminLogPage>>

new AuthAdminClient(opts: IAuthAdminClientOptions): AuthAdminClient
  .findUser(email: string): Promise<IApiResponse<IAdminUserDTO>>
  .getUser(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .listUserSessions(id: string): Promise<IApiResponse<ISessionDTO[]>>
  .revokeUserSessions(id: string): Promise<IApiResponse<undefined>>
  .userLoginHistory(id: string, query?: IAdminLoginHistoryQuery | undefined): Promise<IApiResponse<ILoginHistoryPageResult>>
  .suspendUser(id: string): Promise<IApiResponse<IAdminUserDTO>>
  .unsuspendUser(id: string): Promise<IApiResponse<IAdminUserDTO>>

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

function useAttention(client: AdminClient): { attention: Ref<{ generatedAt: string; ok: boolean; items: { source: string; severity: "error" | "advice"; message: string; }[]; } | null, IAdminAttention | { ...; } | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useManifest(client: AdminClient): { manifest: Ref<{ generatedAt: string; env: string; admin: { version: string; log: boolean; }; modules: { name: string; version: string | null; readiness: { ...; }; describesAdmin: boolean; }[]; readiness: { ...; }; routes: { ...; }[]; } | null, IAdminManifest | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useDoctor(client: AdminClient): { report: Ref<{ generatedAt: string; ok: boolean; checks: { name: string; module: string; ok: boolean; findings: string[]; skipped?: string; durationMs: number; }[]; } | null, IAdminDoctorReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminConfig(client: AdminClient): { report: Ref<{ generatedAt: string; readiness: { ok: boolean; problems: { module: string; severity: "error" | "warning"; message: string; }[]; }; modules: { ...; }[]; env: { ...; }[]; } | null, IAdminConfigReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminRoutes(client: AdminClient): { report: Ref<{ generatedAt: string; routes: { method: string; path: string; module?: string; guard: AdminRouteGuard; }[]; } | null, IAdminRoutesReport | { ...; } | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminTokens(client: AdminClient): { report: Ref<{ generatedAt: string; admin: { ok: boolean; problems: { module: string; severity: "error" | "warning"; message: string; }[]; }; legacy: { module: string; set: boolean; }[]; } | null, IAdminTokensReport | ... 1 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminLog(client: AdminClient, query?: Pick<IAdminLogQuery, "limit">): { entries: Ref<{ id: string; at: string; actor: string; method: string; path: string; route: string; ... 4 more ...; clientIp: string | null; }[], IAdminLogEntry[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }

function useAdminUser(client: AuthAdminClient, by: { email?: Ref<string, string>; id?: Ref<string, string>; }): { user: Ref<{ deletedAt: string | null; id: string; email: string; ... 16 more ...; updatedAt: string; } | null, IAdminUserDTO | ... 1 more ... | null>; ... 5 more ...; revokeSessions: () => Promise<...>; }

function useAdminUserSessions(client: AuthAdminClient, userId: Ref<string | null, string | null>): { sessions: Ref<{ id: string; current: boolean; ipAddress: string | null; userAgent: string | null; createdAt: string; expiresAt: string; }[], ISessionDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useAdminLoginHistory(client: AuthAdminClient, userId: Ref<string | null, string | null>, query?: { limit?: number; }): { events: Ref<{ id: string; method: string; outcome: string; failureReason: string | null; ipAddress: string | null; userAgent: string | null; createdAt: string; }[], ILoginEventDTO[] | { ...; }[]>; ... 4 more ...; loadMore: () => Promise<...>; }
```
