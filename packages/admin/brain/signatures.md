<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/admin — signatures

## @fonderie/admin

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

function buildManifest(app: IFonderieApp, admin: { version: string; }): IAdminManifest

function runDoctor(checks: INamedCheck[], timeoutMs: number): Promise<IAdminDoctorReport>

function collectChecks(app: IFonderieApp, own: IAdminCheck[]): INamedCheck[]

function attention(app: IFonderieApp, doctor: IAdminDoctorReport): IAdminAttention

interface IAdminOptions {
    adminToken?: string;
    path?: string;
    checks?: IAdminCheck[];
    checkTimeoutMs?: number;
}

interface IAdminManifest {
    generatedAt: string;
    env: string;
    admin: {
        version: string;
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
```
