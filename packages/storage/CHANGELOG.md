# @fonderie/storage

## 0.1.31

### Patch Changes

- Updated dependencies [ae2dcc6]
  - @fonderie/core@0.32.0

## 0.1.30

### Patch Changes

- Updated dependencies [4aca9ac]
  - @fonderie/core@0.31.0

## 0.1.29

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0

## 0.1.28

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0

## 0.1.27

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 0.1.26

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 0.1.25

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 0.1.24

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 0.1.23

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 0.1.22

### Patch Changes

- 10d3f42: Every backend brick now ships `env.json`, exported as `@fonderie/<brick>/env.json`, declaring the environment variables it depends on. For each variable the declaration says:
  - where the value comes from: read directly, fed through an option, or set by the host platform;
  - whether it is required, and whether it is a secret;
  - how it is validated and how to generate it;
  - which option it feeds;
  - its all-or-nothing feature groups, such as Sign in with Google or S3.
  
  Bricks that read nothing declare `"vars": []`.
  
  `@fonderie/cli` gains the resolver the upcoming `fonderie env` commands and the admin console build on. It walks an app's `@fonderie/*` dependencies, following their dependencies and required peers but skipping optional peers the app did not install, and merges the declarations into one list. Two bricks declaring the same name with a different kind or secret-ness are an error, never a silent pick.
  
  The monorepo's new `check:env-declarations` CI gate keeps the declarations true:
  - every `process.env` read in a brick's source is declared;
  - every variable declared as read directly is actually read;
  - all bricks resolve together without conflict.

## 0.1.21

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0

## 0.1.20

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 0.1.19

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 0.1.18

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 0.1.17

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.1.16

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 0.1.15

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.1.14

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.1.13

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 0.1.12

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 0.1.11

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 0.1.10

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 0.1.9

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

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
