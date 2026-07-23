# @fonderie/rate-limit

## 1.0.1

### Patch Changes

- c416095: Republish `@fonderie/rate-limit` (1.0.1) to fix the broken `1.0.0` tarball — the third package from the earlier partial release with wrong peer ranges (`@fonderie/core@^1.0.0` / `store@^1.0.0` vs actual `0.2.0` / `0.1.2`), which makes a clean `npm install` of the SDK fail with `ERESOLVE`. Current source is correct (`core@^0.2.0`, `store@^0.1.1`); this `1.0.1` carries the corrected metadata. No code change. (Completes the events/customers `2.0.1` republish — those three were the packages whose `latest` tag had been stale.)

## 1.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0

## 0.1.1

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.
