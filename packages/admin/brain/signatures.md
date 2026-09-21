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

function buildManifest(app: IFonderieApp, admin: { version: string; }): IAdminManifest

interface IAdminOptions {
    adminToken?: string;
    path?: string;
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
```
