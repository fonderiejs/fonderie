<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/config — signatures

## @fonderie/config

Subpath exports: `@fonderie/config/types`, `@fonderie/config/middleware`, `@fonderie/config/migrations`

```ts
new ConfigModule(store: IStoreAdapter, options?: IConfigOptions): ConfigModule
  .name: "@fonderie/config"
  .manager: RemoteConfigManager
  .install(app: IFonderieApp): Promise<void>

new RemoteConfigManager(store: IStoreAdapter, options?: IConfigOptions): RemoteConfigManager
  .boot(): Promise<void>
  .stop(): void
  .get<T>(key: string, fallback: T): T
  .all(): Record<string, unknown>
  .refresh(): Promise<void>
  .isStale(): boolean

const CONFIG_MANAGER_KEY: "fonderie.config.snapshot"

function configContextMiddleware(manager: RemoteConfigManager): Middleware

function getConfig(ctx: { meta: Record<string, unknown>; }, key: string, fallback?: unknown): unknown

function listConfigEntries(environment: string | null, store: IStoreAdapter): Promise<IConfigEntry[]>

function getConfigEntry(key: string, environment: string, store: IStoreAdapter): Promise<IConfigEntry | null>

function setConfigEntry(opts: { key: string; value: unknown; environment?: string; description?: string; active?: boolean; ifVersion?: number; actor?: string; }, store: IStoreAdapter): Promise<IConfigEntry>

function deleteConfigEntry(key: string, environment: string, store: IStoreAdapter): Promise<boolean>

function rollbackConfigEntry(opts: { key: string; environment?: string; toVersion: number; actor?: string; }, store: IStoreAdapter): Promise<IConfigEntry>

function listConfigRevisions(key: string, environment: string, store: IStoreAdapter): Promise<IConfigRevision[]>

new ConfigConflictError(key: string, environment: string, currentVersion: number | null, expectedVersion: number): ConfigConflictError
  .key: string
  .environment: string
  .currentVersion: number | null
  .expectedVersion: number
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IConfigEntry {
    key: string;
    value: unknown;
    environment: string;
    description: string | null;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface IConfigRevision {
    key: string;
    environment: string;
    value: unknown;
    version: number;
    actor: string | null;
    createdAt: string;
}

interface IConfigSnapshot {
    entries: Record<string, unknown>;
    fetchedAt: Date;
}

interface IConfigOptions {
    ttl?: number;
    environment?: string;
    table?: string;
}
```
