# @fonderie/media

Provider-abstracted asset storage for Fonderie — upload, store, and serve
user-owned images (avatars, workspace logos, customer photos) with **zero
infrastructure by default** and object storage as a one-line swap.

Every SaaS needs profile images; getting the *bytes* right (magic-byte
validation, size caps, SVG/stored-XSS rejection, cacheable public serving) is
security-sensitive boilerplate you shouldn't re-derive per app. This brick owns
it once.

## What you get

- `POST /media` — upload a base64 image (guarded: magic-byte sniffing, size cap,
  SVG rejected), returns a `/media/:id` **URL**.
- `GET /media/:id` — **public**, cached image serving (an `<img src>` can't send
  a Bearer token), with `ETag`/`304`.
- `DELETE /media/:id` — uploader-only removal.

The read contract is monomorphic: consumers always get a **URL**, whatever the
backend. Point `@fonderie/auth`'s `avatarUrl` (or `@fonderie/customers`') at it.

## Wire it

```ts
import { MediaModule, DbBlobProvider } from '@fonderie/media';

app.register(new MediaModule(store, {
  provider: new DbBlobProvider(store), // zero infra — bytes live in Postgres
  maxBytes: 1_000_000,
}));
```

Run **both** migrations — media's (`fonderie_media_assets` metadata) and
`@fonderie/storage`'s (`fonderie_storage_blobs`, where `DbBlobProvider` writes).
Forgetting storage's makes DbBlob uploads fail at runtime:

```ts
import { getMigrationsPath as mediaMigrations }   from '@fonderie/media/migrations';
import { getMigrationsPath as storageMigrations } from '@fonderie/storage/migrations';
await new InternalMigrationRunner(store, storageMigrations()).run();
await new InternalMigrationRunner(store, mediaMigrations()).run();
```

## Storage & access

Byte storage lives in **`@fonderie/storage`** (media re-exports the zero-infra
providers for convenience):

- **`DbBlobProvider`** — bytes in Postgres. Zero infra; the default.
- **`LocalFsProvider`** — bytes on disk.
- **`S3Provider`** (S3 / MinIO / R2) — `import { S3Provider } from '@fonderie/storage/s3'`.

Swapping backends is one config line; the `/media/:id` URL contract is unchanged.

**Access model:** `GET /media/:id` is **public** — an `<img src>` can't carry a
Bearer token, and ids are unguessable UUIDs (capability URLs). Right for
avatars/logos; it is **not** an access-controlled store for private or sensitive
files — serve those through your own authenticated route.

**Owner authorization:** uploads default to self-owned user assets only
(`ownerType: 'user'`, `ownerId` = the caller). To allow workspace logos, customer
photos, etc., pass `authorizeOwner(ctx, owner)` in the module config.
