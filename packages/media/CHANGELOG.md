# @fonderie/media

## 0.3.4

### Patch Changes

- 2686f16: Error messages in the reader's language. The screens showed the server's English sentence to everyone; a wrong password now reads « Le courriel ou le mot de passe est incorrect. » for a fr-CA user, 「電子郵件或密碼不正確。」 for zh-TW.
  
  - **`localizeApiError(error, locale)`** (client):
    - English readers keep the server's exact sentence.
    - Every other language gets the message for the error's reason code, filled from its `details`.
    - If the code is unknown or a value is missing, they get the generic message for the status, never a half-filled sentence.
    - An offline failure reads "couldn't reach the server" in every language, instead of "TypeError: Failed to fetch".
    - Covers 57 user-facing reason codes (sign-in, teams, billing, customers, uploads) plus 12 generic messages, in en/fr/es/zh-Hans/zh-Hant.
  - **`useUiError(source?, locale?)`** in `@fonderie/react` and `@fonderie/vue` returns that function in the app's UI language, following `setLocale()`.
  - **Every prebuilt screen** (all 18 packages) shows errors through it.
  - **Server:** `PLAN_UNCHANGED` (`plan`, `interval`), `FEATURE_UNAVAILABLE` (`feature`), `ASSET_TOO_LARGE` (`maxBytes`, `maxMegabytes`) and `ASSET_UNSUPPORTED` (`allowed`) now send their values in `details`, like the other messages that name a value. The English sentences are unchanged.

## 0.3.3

### Patch Changes

- Updated dependencies [4aca9ac]
  - @fonderie/core@0.31.0

## 0.3.2

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0

## 0.3.1

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0

## 0.3.0

### Minor Changes

- ad560bd: **Image uploads from phones.** A JPEG picked on Android was refused with "Unsupported image type."
  
  **The hooks now take the image as base64.** `uploadAvatar` and `upload` accept `{ base64 }`, as a raw payload or a `data:` URL, as well as a Blob.
  - Use base64 on React Native. Pickers return it directly: expo-image-picker with `base64: true`, or expo-image-manipulator.
  - Turning a file URI into a Blob there goes through fetch, the native blob store and FileReader. That chain can hand the server bytes that are not the image.
  - `MediaInput` is exported.
  
  **`@fonderie/media`:**
  - A rejected upload now says what arrived, not only what is allowed:
    - "This is a HEIC/HEIF photo (what phones save by default): convert it to JPEG before uploading."
    - "The image was base64-encoded twice."
    - "The payload is a data: URL."
  - HEIC/HEIF and AVIF are recognised by their bytes. They are still refused by default, since most browsers can't display HEIC. A deployment can opt in through `allowedTypes`.

## 0.2.28

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 0.2.27

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 0.2.26

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 0.2.25

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 0.2.24

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 0.2.23

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

## 0.2.22

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0

## 0.2.21

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 0.2.20

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 0.2.19

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 0.2.18

### Patch Changes

- 34aef24: Every module reports its version, so the Modules page can answer
  
  `IFonderieModule.version` is optional, and `@fonderie/admin` was the only
  module that set it. The operator's Modules page exists to answer "what is
  actually deployed here" and answered it for one module out of six — every
  other row read "not reported", which is honest and useless.
  
  `tsup.base` now bakes `FONDERIE_PKG_VERSION` into every build (tsup runs with
  cwd set to the package being built, so it reads the right `package.json`
  without each config passing its own), and each module reports it. Admin drops
  its bespoke `FONDERIE_ADMIN_VERSION` for the shared one.
  
  A test walks `packages/*/src/module.ts` and fails when a class implementing
  `IFonderieModule` does not report a version — it caught `@fonderie/logger`,
  which was missing from the first pass.

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
