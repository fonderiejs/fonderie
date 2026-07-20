<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/config — signatures

## @fonderie/config

Subpath exports: `@fonderie/config/types`, `@fonderie/config/middleware`, `@fonderie/config/migrations`

```ts
new RemoteConfigModule(store: IStoreAdapter, options?: IRemoteConfigOptions): RemoteConfigModule
  .name: "@fonderie/config"
  .manager: RemoteConfigManager
  .install(app: IFonderieApp): Promise<void>

new RemoteConfigManager(store: IStoreAdapter, options?: IRemoteConfigOptions): RemoteConfigManager
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

function setConfigEntry(opts: { key: string; value: unknown; environment?: string; description?: string; active?: boolean; }, store: IStoreAdapter): Promise<IConfigEntry>

function deleteConfigEntry(key: string, environment: string, store: IStoreAdapter): Promise<boolean>

interface IConfigEntry {
    key: string;
    value: unknown;
    environment: string;
    description: string | null;
    active: boolean;
    updatedAt: string;
}

interface IConfigSnapshot {
    entries: Record<string, unknown>;
    fetchedAt: Date;
}

interface IRemoteConfigOptions {
    ttl?: number;
    environment?: string;
    table?: string;
}
```
