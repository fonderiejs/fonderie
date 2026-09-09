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

Run its migration alongside the others (it owns `fonderie_*` tables):

```ts
import { getMigrationsPath } from '@fonderie/media/migrations';
await new InternalMigrationRunner(store, getMigrationsPath()).run();
```

## Storage providers

`IStorageProvider` is the seam — `put` / `get` / `delete`, with `get` returning
either bytes (app serves them) or a redirect URL (backend serves them, e.g. an
S3 signed URL). Two zero-infra backends ship built in:

- **`DbBlobProvider`** — bytes in Postgres (`fonderie_media_blobs`). One process,
  one database, atomic backups. The default.
- **`LocalFsProvider`** — bytes on the server filesystem.

Implement the interface to add object storage (`S3Provider`, etc.) without
touching product code — the same pattern `@fonderie/billing` uses for payment
providers.
