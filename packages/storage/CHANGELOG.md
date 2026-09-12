# @fonderie/storage

## 0.1.8

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 0.1.7

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 0.1.6

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 0.1.5

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 0.1.4

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 0.1.3

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 0.1.1

### Patch Changes

- d78ddd8: Harden the storage providers:
  
  - `DbBlobProvider.get`/`delete` now treat a **non-UUID ref** as not-found
    (`null` / no-op) instead of throwing a Postgres `invalid input syntax for type
    uuid` error — a foundation provider shouldn't throw on a foreign or stale ref,
    and the interface contract is null-on-missing.
  - `LocalFsProvider` clears its cached `mkdir` promise on failure, so a transient
    error (e.g. a briefly-unmounted volume) doesn't stick a rejected promise that
    breaks every later `put`.
  - Documented the `IStorageProvider.get` null-contract nuance: `S3Provider`
    returns a presigned redirect **without** verifying existence, so consumers
    that must detect "gone" without following the URL should keep their own
    metadata (as `@fonderie/media` does).

## 0.1.0

### Minor Changes

- b7dca31: Add `@fonderie/storage` — content-agnostic, provider-abstracted object storage.
  Store any bytes behind one `IStorageProvider` interface (`put`/`get`/`delete`),
  with `get` returning either bytes or a redirect URL so consumers never branch on
  the backend.
  
  - `DbBlobProvider` (Postgres `fonderie_storage_blobs` — zero infra) and
    `LocalFsProvider` (disk) ship built in.
  - `S3Provider` for any S3-compatible store — **AWS S3, MinIO, R2, B2, Spaces**
    (one provider, parameterized by `endpoint`) — lives at the
    `@fonderie/storage/s3` subpath, so its `@aws-sdk/*` optional peers load only
    when used; `get` returns a presigned redirect URL so the app never proxies
    bytes.
  - The low-dependency foundation `@fonderie/media` (and future archival bricks)
    build on. Ships `fonderie_storage_blobs` via `@fonderie/storage/migrations`.
