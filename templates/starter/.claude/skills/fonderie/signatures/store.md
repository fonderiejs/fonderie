<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/store — signatures

## @fonderie/store

Subpath exports: `@fonderie/store/sql`, `@fonderie/store/types`, `@fonderie/store/migrations`

```ts
function sql(strings: TemplateStringsArray, ...values: unknown[]): ISqlQuery

interface ISqlQuery {
    text: string;
    params: unknown[];
}

interface IStoreAdapter {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>;
}

interface IPoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: boolean | {
        rejectUnauthorized: boolean;
    };
}

new MigrationRunner(store: IStoreAdapter, migrationsDir: string): MigrationRunner
  .run(): Promise<void>

new InternalMigrationRunner(store: IStoreAdapter, migrationsDir: string): InternalMigrationRunner
  .run(): Promise<void>

function createMigrationsPath(importMetaUrl: string): string

new PGAdapter(config: string | IPoolConfig): PGAdapter
  .testConnection(): Promise<boolean>
  .query<T = unknown>(sql: string, params?: unknown[] | undefined): Promise<T[]>
  .transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>
  .end(): Promise<void>

function versionedWrite<T>(r: IVersionedResource, store: IStoreAdapter, opts: { key: string; scope: string | null; data: Record<string, unknown>; ifVersion?: number; actor: string | null; }): Promise<...>

function versionedRollback<T>(r: IVersionedResource, store: IStoreAdapter, opts: { key: string; scope: string | null; toVersion: number; actor: string | null; }): Promise<T>

new VersionConflictError(key: string, scope: string | null, currentVersion: number | null, expectedVersion: number): VersionConflictError
  .key: string
  .scope: string | null
  .currentVersion: number | null
  .expectedVersion: number
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IVersionedResource {
    table: string;
    revisions: string;
    channel: string;
    keyColumns: readonly [
        string,
        string
    ];
    contentColumns: readonly string[];
    metaColumns?: readonly string[];
    returning: string;
}
```
