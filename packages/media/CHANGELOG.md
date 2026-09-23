# @fonderie/media

## 0.2.17

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.2.16

### Patch Changes

- 38f2410: Use one definition of a request path
  
  `@fonderie/media` recovered the app's `basePath` by stripping `/media` off
  the request path, which a trailing slash defeated — `/v1/media/` yielded no
  basePath and the served URL came out wrong. It now normalizes first.
  `@fonderie/logger` logs the normalized path, so `/x` and `/x/` group as one
  route. `@fonderie/client`'s six admin clients shared six copies of the same
  prefix strip; now one, kept local because this package has zero runtime
  dependencies by design.

## 0.2.15

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.14

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.2.13

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 0.2.12

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 0.2.11

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 0.2.10

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 0.2.9

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 0.2.8

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 0.2.7

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 0.2.6

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

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
