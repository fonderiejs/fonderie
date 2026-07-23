# @fonderie/customers

## 2.0.1

### Patch Changes

- 3cdc21c: Republish `@fonderie/events` and `@fonderie/customers` to fix broken `2.0.0` tarballs. Those two were published from an earlier partial release built when `core`/`store` were assumed to be `1.0.0`, so their tarballs shipped **wrong peer ranges** (`@fonderie/core@^1.0.0`, `@fonderie/store@^1.0.0` — but those are `0.2.0`/`0.1.2`, so `npm install` failed with `ERESOLVE`), and `events@2.0.0` also **shipped without its migration SQL** (`dist/migrations/sql` absent → wouldn't boot). The current source is correct (`core@^0.2.0`, `store@^0.1.1`) and a fresh build includes the SQL; this `2.0.1` republish carries the corrected metadata and complete tarballs. No code change.

## 2.0.0

### Minor Changes

- cc6fbfd: Add referral codes to customers. Every customer now auto-gets a random, **workspace-unique** `referralCode` at creation (safe to share — non-sequential, so it can't be guessed by incrementing), alongside the existing sequential `referenceCode` and the UUID primary key. New customers can pass `referredByCode` at signup: it resolves to the referrer within the same workspace and sets `referredBy` (a nullable FK), giving a clean 1:many referrer→referees relationship. An unknown `referredByCode` is ignored, not an error. Two workspaces may share a referral code; two customers in one workspace cannot (enforced by a partial unique index). Verified end-to-end against Postgres.

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
- Updated dependencies [c0f05ea]
  - @fonderie/core@0.2.0
  - @fonderie/workspaces@2.0.0
  - @fonderie/events@2.0.0

## 1.1.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.1.0

### Minor Changes

- One request-validation layer across every endpoint-exposing package:

  - `validate(schema)` middleware in `@fonderie/core/middlewares` (structural
    `safeParse` interface — core stays dependency-free)
  - zod request schemas on all 43 body-taking routes across auth, workspaces,
    billing, customers, and webhooks; invalid input returns 422
    `INVALID_PARAMETER` with a field path before the controller runs; parsed
    bodies are trimmed and stripped of unknown keys
  - schemas exported per package (`schemas.*`) so docs generators and typed
    clients read the same contract the runtime enforces
  - provider-shaped webhooks (`/billing/webhook`, `/courier/delivery/*`) are
    deliberately exempt — gated by signature verification instead

## 1.0.1

### Patch Changes

- Packaging and DX fixes found by dogfooding a fresh AI-agent install:

  - Every `@fonderie/*/migrations` subpath now actually ships its declared
    `index.d.ts` — the two parallel tsup dts passes raced over `dist/` and the
    migrations declaration was lost on multi-entry packages. Migrations now
    build as a separate sequential pass.
  - The adapters' optional peers are now truly optional: `withWorkspace`,
    `requirePermission`, and `requireFeature` lazy-load
    `@fonderie/workspaces`/`permissions`/`billing` on first request instead of
    statically importing them at module load, with a targeted install error
    when the peer is genuinely missing.
  - `OPERATIONS` and the `Operation` type moved to `@fonderie/core`;
    `@fonderie/permissions` and the adapters re-export them unchanged.

- Updated dependencies
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/workspaces@1.0.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
  - @fonderie/workspaces@1.0.0
