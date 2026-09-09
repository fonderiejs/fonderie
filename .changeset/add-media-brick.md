---
'@fonderie/media': minor
---

Add `@fonderie/media` — provider-abstracted asset storage for user-owned images
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
