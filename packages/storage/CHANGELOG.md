# @fonderie/storage

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
