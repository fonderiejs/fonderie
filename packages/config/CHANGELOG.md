# @fonderie/config

## 4.0.0

### Minor Changes

- 5a0d76e: Config control-plane, phase 4 — the safe admin HTTP surface. `ConfigModule`
  registers `/admin/config/*` and `/admin/secrets/*` routes **only when an
  `adminToken` is configured** (fail-closed — no token, no exposed admin surface),
  each guarded by a `Bearer` token. Endpoints: list / get / put (with `ifVersion`
  optimistic concurrency → **409** on a lost compare-and-swap) / delete /
  `GET :key/revisions` / `POST :key/rollback`, for both config and secrets. Secret
  reads stay masked; `POST /admin/secrets/:key/reveal` is the single decrypt path.
  Writes record an actor (optional `X-Actor` header). A `secretEncryptor` option
  wires at-rest encryption. Exports `buildAdminRoutes`.
- 3dd9c36: Config control-plane, phase 2 — push propagation. A config write now emits
  `pg_notify('fonderie_config_changed', env)` on commit, and `RemoteConfigManager`
  gains an optional `connectionUrl`: when set, it opens a dedicated `LISTEN` client
  and refreshes its snapshot within **milliseconds** of any write (replacing the
  30s poll latency; the `ttl` poll becomes a slow safety floor). Unset =
  poll-only, unchanged. `pg` is a peer dependency (matching `@fonderie/events`).
  Proven end-to-end against real Postgres: a write on one connection propagates to
  a separate manager's snapshot in ~400ms while a poll-only control stays stale.
- 71a27f8: Config control-plane, phase 3 — the **secret** kind (ConfigMap vs Secret). A
  separate `fonderie_secrets` table + read path sharing config's exact lifecycle
  (version index, optimistic concurrency, advisory-locked writes, revisions,
  rollback, push-notify) but with secret-grade exposure: admin `getSecret` /
  `listSecrets` return **metadata only — never the value** (masked), and the value
  is **encrypted at rest** via a pluggable `ISecretEncryptor` (`noopEncryptor`
  default; `createAesGcmEncryptor(keyHex)` for real AES-256-GCM). `revealSecret` is
  the single decrypt path. `pg_notify` payloads carry the environment only, never
  the value. Exports: `setSecret`/`getSecret`/`revealSecret`/`listSecrets`/
  `rollbackSecret`/`listSecretRevisions`/`deleteSecret`, `ISecretEntry`/
  `ISecretRevision`, `ISecretEncryptor`/`noopEncryptor`/`createAesGcmEncryptor`.
- e8c5e96: Config control-plane, phase 1 — version index, revisions, rollback, optimistic
  concurrency. Each write bumps a monotonic `version` and appends an immutable
  revision (`fonderie_config_revisions`); `updated_by` records the actor.
  `setConfigEntry` takes an optional `ifVersion` (compare-and-swap — commits only
  if the version matches, else throws `ConfigConflictError`; reject-and-retry) and
  `actor`. New `rollbackConfigEntry` rolls _forward_ to a past value (k8s `rollout
undo`), and `listConfigRevisions` returns the history. Concurrency is safe: an
  advisory xact lock keyed on `(key, environment)` serializes writers even for a
  key that doesn't exist yet (closing the create-race the row lock can't cover).
  Existing `setConfigEntry` callers are unaffected (the new fields are optional).

### Patch Changes

- d549e46: Test coverage + docs pass over the control plane: unit tests for the previously
  proof-only paths (rollback config/secret, config/secret revisions, secret reveal,
  delete secret), and a rewritten README documenting versioning, optimistic
  concurrency, rollback, secrets (masked/encryptable), the admin HTTP surface, the
  CLI, and push propagation. Dependencies confirmed minimal (zero runtime deps;
  peers core/store/pg only).
- ce666fb: Config control-plane, phase 6 (generalize) — lift the version index / optimistic
  concurrency / advisory-locked write / append-only revisions / rollback /
  push-notify machinery into a shared `versionedWrite` + `versionedRollback`
  primitive (`services/versioned.ts`) that both `config` and `secrets` now run on.
  Removes the ~1:1 duplication between the two services and makes a new versioned
  admin resource a table descriptor + its read shape away. Pure internal refactor
  — no public API or behavior change (`ConfigConflictError` is re-exported from the
  same path); all 29 tests green + re-proven end-to-end against real Postgres for
  both resources (OCC, revisions, rollback, secret encrypt/mask/reveal, and the
  resource-specific `fonderie_config_changed` / `fonderie_secrets_changed`
  channels).
- da7e79c: Lift the versioned-resource control-plane primitive into `@fonderie/store` so any
  package can reuse it (no `config` dependency). `versionedWrite` /
  `versionedRollback` / `VersionConflictError` are now exported from store,
  generalized: a resource declares its `(primary, scope)` key columns (null-safe —
  a NULL scope is the base), its revisioned `contentColumns` (one or many), and
  optional main-table `metaColumns`. This serves config's `(key, environment,
value)` and courier's `(type, locale, subject/html/text)` shapes alike.
  `@fonderie/config` re-points onto it; `ConfigConflictError` is now an alias of
  `VersionConflictError` (same exported name, `instanceof` unchanged). Behavior
  preserved — config 36/36 + store tests green, and both shapes proven end-to-end
  against real Postgres (incl. NULL scope + multi-column rollback).
- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0

## 1.0.3

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.0.2

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

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
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/store@0.1.0
