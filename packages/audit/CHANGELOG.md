# @fonderie/audit

## 5.2.4

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 5.2.3

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

## 5.2.2

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 5.2.1

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 5.2.0

### Minor Changes

- 83fdb67: Describe the cross-workspace read for `@fonderie/admin`
  
  `describeAdmin()` offers `GET /audit` under the admin prefix: the same
  filters (`type`, `actorId`, `from`, `to`, `limit`, `cursor`) and DTO as the
  workspace-scoped route, with `workspaceId` optional — every workspace unless
  one is named. `AuditEventModel.listAcross()` backs it. No standalone
  surface. Phase 8d of `docs/ADMIN-BRICK-DESIGN.md`.

## 5.1.15

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 5.1.14

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 5.1.13

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 5.1.12

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 5.1.11

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 5.1.10

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 5.1.9

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 5.1.8

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 5.1.7

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 5.1.6

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 5.1.5

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 5.1.4

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 5.1.3

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 5.1.2

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.1.1

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.1.0

### Minor Changes

- f3656f8: Consolidate three cross-package duplications into shared @fonderie/core primitives (from the consolidation audit).
  
  - **`constantTimeEqual(a, b)`** (new core export) — the one timing-safe compare. Replaces byte-identical copies in auth (MFA/TOTP codes), events (event-log HMAC), courier (SendGrid/Mailgun webhook-signature verification), and core's own admin-token guard. Prevents any copy silently dropping the length-guard or swapping to `===` and reintroducing a per-module timing side-channel.
  - **`secretStrengthProblem` / `PLACEHOLDER_SECRET` / `MIN_SECRET_LENGTH`** (new core exports) — one weak/placeholder-secret denylist. auth's `jwtSecret`/`clientSecret` checks and core's `validateAdminToken` now share it (the two regexes had already drifted by one term). Call-site policy (required vs optional, field name) stays per-module.
  - **`encodeKeysetCursor` / `decodeKeysetCursor`** (new core exports) — one keyset-pagination cursor over `(created_at, id)`. billing's wallet ledger and audit's event log now share it. **Fixes a real bug in `@fonderie/audit`**: its local decode lacked timestamp field-range checks, so a crafted in-shape-but-out-of-range cursor reached the `::timestamptz` cast as a **500**; it now decodes to null (the model drops the keyset predicate and returns the first page) instead of 500ing. audit's opaque cursor wire format changes to the shared one (in-flight cursors restart pagination — acceptable for an opaque cursor).
  
  Behavior-preserving elsewhere (billing's public `encode/decodeLedgerCursor` are kept as aliases; auth also adopts the existing `dateOrEmpty` for session/user timestamps, fixing a latent `''`-for-string-input inconsistency). Adversarially reviewed; no public API removed.

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.0.2

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.0.1

### Patch Changes

- d32b21c: Audit pagination reaches past the max page, and webhook retries actually retry
  
  Two silent runtime failures. In @fonderie/audit, the route over-fetched
  `limit + 1` rows to detect a next page while the model re-clamped to
  MAX_LIMIT — at the maximum page size the two caps cancelled, `nextCursor`
  could never be set, and pagination silently ended at the boundary. The +1
  over-fetch now lives inside the model (which returns `{ events, hasMore }`),
  so no outer clamp can shave it off. The keyset cursor also now carries
  `created_at::text` at full microsecond precision instead of a
  millisecond-truncated JS Date — events created in the same millisecond
  (e.g. within one transaction) are no longer skipped between pages — and
  cursor halves are validated (timestamp shape, UUID) so a crafted cursor
  yields an empty clause instead of a Postgres cast error. The route's limit
  parse is NaN-safe.
  
  In @fonderie/webhooks, `IPendingRetry` declared a nested
  `{ delivery, url, secret }` shape that the flat claim-query row never
  produced — `retry()` destructured `delivery` as undefined and threw on
  every claimed row, swallowed by `Promise.allSettled`. Net effect: failed
  deliveries were re-claimed every interval and never actually retried, with
  nothing logged. The type is now the flat row it always was, `retry()`
  destructures accordingly, and a new test pins the full path: claim →
  re-attempt with correct URL/signature → marked delivered.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0

## 4.0.0

### Patch Changes

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

## 1.0.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/store@0.1.0
