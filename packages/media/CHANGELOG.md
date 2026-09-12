# @fonderie/media

## 0.2.5

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 0.2.4

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 0.2.3

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 0.2.1

### Patch Changes

- d78ddd8: Harden avatar upload (audit follow-ups):
  
  - **Size guard before decode:** reject an oversized upload by its base64 length
    *before* decoding, bounding the decode allocation — previously a large payload
    was fully materialized into a buffer only to be rejected. (Pair with a
    request-body-size limit at the adapter for full coverage.)
  - **Owner authorization:** uploads now default to **self-owned user assets
    only** (`ownerType: 'user'`, `ownerId` = the caller). A new optional
    `config.authorizeOwner(ctx, owner)` hook permits other owners (workspace
    logos, customer photos). Previously any `ownerType`/`ownerId` was accepted.
  - **No orphaned bytes:** if the metadata insert fails after the bytes are
    stored, the stored object is deleted before the error propagates.
  - **Docs:** `GET /media/:id` is a public capability URL (unguessable UUID) — not
    an access-controlled store for private assets; and consumers must run
    `@fonderie/storage`'s migration alongside media's.

## 0.2.0

### Minor Changes

- b7dca31: media now builds on `@fonderie/storage`. The storage providers
  (`IStorageProvider`, `DbBlobProvider`, `LocalFsProvider`) moved out of this
  package into `@fonderie/storage` and are re-exported here for compatibility;
  `S3Provider` (object storage / MinIO) is available from `@fonderie/storage/s3`.
  
  Byte storage moved to `fonderie_storage_blobs` — **run `@fonderie/storage`'s
  migration** alongside media's — and the now-unused `fonderie_media_blobs` table
  is dropped by media migration `002`. `@fonderie/storage` is a new peer
  dependency. No change to the upload/serve HTTP API.

## 0.1.0

### Minor Changes

- f2bb709: Add `@fonderie/media` — provider-abstracted asset storage for user-owned images
  (avatars, logos, customer photos).
  
  - `MediaModule` registers `POST /media` (base64 upload, guarded by magic-byte
    sniffing + a size cap, SVG rejected as a stored-XSS vector), a **public**
    cached `GET /media/:id` (an `<img src>` can't send a Bearer token), and an
    uploader-only `DELETE /media/:id`.
  - `IStorageProvider` is the storage seam (same pattern as billing's payment
    providers): `DbBlobProvider` (bytes in Postgres — zero infra) and
    `LocalFsProvider` (bytes on disk) ship built in; implement the interface to
    add object storage without touching product code. `get` returns either bytes
    (app serves) or a redirect URL (backend serves, e.g. an S3 signed URL), so the
    read contract stays a plain `/media/:id` URL regardless of backend.
  - Ships its migration at `@fonderie/media/migrations`
    (`fonderie_media_assets` + `fonderie_media_blobs`).
