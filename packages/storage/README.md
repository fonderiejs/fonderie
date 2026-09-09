# @fonderie/storage

Content-agnostic, provider-abstracted **object storage** — store any bytes
behind one interface, on Postgres, disk, or any S3-compatible service
(S3 / MinIO / R2 / B2 / Spaces). The low-dependency foundation other bricks
build on: `@fonderie/media` (uploads/serving), DB archives, datasets, anything.

Start on Postgres for free; flip one config line to real object storage when
scale (or a paying customer) justifies it — no consumer code changes.

## The interface

```ts
interface IStorageProvider {
  put(input: { bytes: Uint8Array; contentType: string }): Promise<{ ref: string }>;
  get(ref: string): Promise<{ kind: 'bytes'; bytes: Uint8Array } | { kind: 'redirect'; url: string } | null>;
  delete(ref: string): Promise<void>;
}
```

`get` returns **bytes** (you serve/write/parse them) or a **redirect URL** (the
backend serves it, e.g. an S3 presigned URL) — so consumers never branch on
which backend is wired.

## Providers

- **`DbBlobProvider`** — bytes in Postgres (`fonderie_storage_blobs`). Zero infra;
  one process + one database; atomic `pg_dump` backups. The default.
- **`LocalFsProvider`** — bytes on the server filesystem. Single-box, no DB bloat.
- **`S3Provider`** — any S3-compatible store. `get` returns a presigned redirect
  so the app never proxies bytes.

```ts
import { DbBlobProvider, LocalFsProvider } from '@fonderie/storage';
import { S3Provider } from '@fonderie/storage/s3'; // opt-in; pulls the AWS SDK peers

const dev  = new DbBlobProvider(store);
const prod = new S3Provider({ bucket: 'assets', endpoint: 'http://minio:9000', accessKeyId, secretAccessKey });
```

`S3Provider` needs the optional peers `@aws-sdk/client-s3` and
`@aws-sdk/s3-request-presigner`; they're only loaded when you import
`@fonderie/storage/s3`, so DbBlob/LocalFs users stay dependency-free.

## Migration

`DbBlobProvider` needs its table — run the migration alongside your others:

```ts
import { getMigrationsPath } from '@fonderie/storage/migrations';
await new InternalMigrationRunner(store, getMigrationsPath()).run();
```
