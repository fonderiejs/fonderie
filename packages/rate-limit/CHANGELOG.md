# @fonderie/rate-limit

## 4.0.5

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 4.0.4

### Patch Changes

- c4663d4: `MemoryStore` accepts an optional injectable clock — `new MemoryStore({ now })`, defaulting to `Date.now`. This makes the operation-triggered idle sweep deterministically testable and fixes a flaky test ("sweep evicts idle keys, keeps fresh ones") that raced the wall clock: the 1024 warm-up `consume()` calls could, under load, take longer than the rule's refill window, so early "fresh" keys aged past it and the sweep evicted them too, dropping the store below the asserted size. The default wall-clock behavior is unchanged.

## 4.0.3

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 4.0.2

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 4.0.1

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 4.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0

## 3.0.0

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0

## 2.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0

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
