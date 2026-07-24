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
```
