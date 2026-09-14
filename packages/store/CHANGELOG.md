# @fonderie/store

## 0.5.0

### Minor Changes

- ff1120b: Two guards for failures that actually happened, each caught where it is cheap
  instead of where it is confusing.
  
  **Migrations that would run out of order now refuse to run.** Files are applied
  lexicographically, so `"1100_" < "200_"` — a migration numbered past the widest
  existing prefix runs FIRST, before the tables it alters exist. It is invisible
  on a database that already has the earlier ones applied, so production stays
  green while CI, a new contributor's first setup and a restore from backup all
  break. Detection is exact rather than a style rule: the lexicographic order is
  compared against the numeric one, so a consistently padded scheme, timestamp
  prefixes and unnumbered files are never flagged. The error names the file that
  actually moved and how to renumber it.
  
  **`consume: true` against a connection that cannot LISTEN now says so.** A
  transaction-mode pooler lends a backend per transaction and takes it back, so a
  LISTEN registered on one is gone by the next statement — poolers reject it
  outright. The raw error only reports an unsupported statement, on a connection
  string that works everywhere else in the app, which reads as "the database is
  broken". `explainListenFailure` (exported, alongside `explainDrainFailure`)
  names the cause and both fixes: point the consumer at the session-mode endpoint
  — same database, same credentials, different port — or set `consume: false` and
  drain on a schedule, which issues no LISTEN and runs anywhere.

## 0.4.0

### Minor Changes

- b932c3c: Add `MigrationRunner.pending()` — which migrations this database has not applied, without applying them.
  
  Migrations run out of band, so a deployment routinely goes live ahead of them. Publishing keeps working, boot succeeds, and the gap only surfaces when some request happens to touch the new column or table. The symptom then looks nothing like the cause: a queue that will not drain, an OAuth callback that hangs, a health route that 500s — each diagnosed separately, none of them saying "you did not run the migration".
  
  That happened twice in one day in this repo, to two different subsystems, after the cause had already been documented. Better error messages did not prevent the second one; a number that can be read *before* anything fails might.
  
  Read-only, and safe to call on the request path. A missing migrations table means nothing has ever been applied, so every file is pending — that is the answer, not an error, which matters because the caller is usually a health route on a fresh deployment.

## 0.3.0

### Minor Changes

- cd2706a: Migration-runner cross-process lock + full TLS gate. (1) The migration runner had no cross-process serialization: several instances booting at once all saw the same pending list and raced to apply the same file. Each migration transaction now takes `pg_advisory_xact_lock` on the migrations table and re-checks the applied set inside the lock, so the losers no-op instead of double-applying. (2) The production TLS gate only inspected the connection-string form (`sslmode=disable`); the config-object form now gets the same rule — `ssl: false` in production throws at boot. Unset `ssl` remains allowed (unix sockets, PG* env vars, string-borne TLS).

## 0.2.2

### Patch Changes

- b134da7: Smoke-test OIDC Trusted Publishing across re-added publishers (no functional change).

## 0.2.1

### Patch Changes

- 7f6ca36: Freeze-prep docs: document `IVersionedResource.keyColumns` as an intentional
  fixed 2-tuple. Every versioned resource is addressed by exactly one primary key
  plus one optional null-safe scope; composite 3+-part keys are out of scope by
  design (model the extra dimension inside the primary key or scope). States the
  limit as an owned contract ahead of freezing the surface.

## 0.2.0

### Minor Changes

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

## 0.1.2

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 0.1.1

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

## 0.1.0

### Minor Changes

- First public release of the Fonderie SDK.
