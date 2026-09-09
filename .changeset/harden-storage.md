---
'@fonderie/storage': patch
---

Harden the storage providers:

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
