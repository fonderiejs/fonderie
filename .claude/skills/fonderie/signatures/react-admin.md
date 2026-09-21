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

new AdminClient(opts: IAdminClientOptions): AdminClient
  .attention(): Promise<IApiResponse<IAdminAttention>>
  .manifest(): Promise<IApiResponse<IAdminManifest>>
  .doctor(): Promise<IApiResponse<IAdminDoctorReport>>
  .config(): Promise<IApiResponse<IAdminConfigReport>>
  .routes(): Promise<IApiResponse<IAdminRoutesReport>>
  .tokens(): Promise<IApiResponse<IAdminTokensReport>>
  .adminLog(query?: IAdminLogQuery | undefined): Promise<IApiResponse<IAdminLogPage>>

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
}

interface IUseAdminLogReturn {
    entries: IAdminLogEntry[];
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
```
