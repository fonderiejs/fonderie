---
'@fonderie/media': minor
---

media now builds on `@fonderie/storage`. The storage providers
(`IStorageProvider`, `DbBlobProvider`, `LocalFsProvider`) moved out of this
package into `@fonderie/storage` and are re-exported here for compatibility;
`S3Provider` (object storage / MinIO) is available from `@fonderie/storage/s3`.

Byte storage moved to `fonderie_storage_blobs` — **run `@fonderie/storage`'s
migration** alongside media's — and the now-unused `fonderie_media_blobs` table
is dropped by media migration `002`. `@fonderie/storage` is a new peer
dependency. No change to the upload/serve HTTP API.
