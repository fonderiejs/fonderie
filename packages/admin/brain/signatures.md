<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/admin — signatures

## @fonderie/admin

Subpath exports: `@fonderie/admin/migrations`

```ts
new AdminModule(options?: IAdminOptions): AdminModule
  .name: "@fonderie/admin"
  .version: string
  .path: string
  .install(app: IFonderieApp): void
  .checkReadiness(): IReadinessProblem[]

const ADMIN_VERSION: string

const DEFAULT_ADMIN_PATH: "/_admin"

const DEFAULT_CHECK_TIMEOUT_MS: 10000

function buildManifest(app: IFonderieApp, admin: { version: string; log: boolean; }): IAdminManifest

function runDoctor(checks: INamedCheck[], timeoutMs: number): Promise<IAdminDoctorReport>

function collectChecks(app: IFonderieApp, own: IAdminCheck[]): INamedCheck[]

function attention(app: IFonderieApp, doctor: IAdminDoctorReport): IAdminAttention

function adminLog(store: IStoreAdapter, route: string, module: string): Middleware

function readAdminLog(store: IStoreAdapter, opts?: { limit?: number; before?: string; }): Promise<IAdminLogPage>

const DEFAULT_ACTOR: "admin-token"

const MAX_PAGE: 200

interface IAdminOptions {
    adminToken?: string;
    path?: string;
    checks?: IAdminCheck[];
    checkTimeoutMs?: number;
    store?: IStoreAdapter;
}

interface IAdminManifest {
    generatedAt: string;
    env: string;
    admin: {
        version: string;
        log: boolean;
    };
    modules: IAdminModuleEntry[];
    readiness: IReadinessReport;
    routes: IRouteEntry[];
}

interface IAdminModuleEntry {
    name: string;
    version: string | null;
    readiness: IReadinessReport;
    describesAdmin: boolean;
}

interface IAdminCheckResult extends IAdminCheckReport {
    name: string;
    module: string;
    durationMs: number;
}

interface IAdminDoctorReport {
    generatedAt: string;
    ok: boolean;
    checks: IAdminCheckResult[];
}

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
```
