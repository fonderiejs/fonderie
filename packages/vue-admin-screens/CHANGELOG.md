# @fonderie/vue-admin-screens

## 0.5.0

### Minor Changes

- db925e5: Access: issue and revoke scoped tokens from the page
  
  `useAdminTokens` gains `issue` and `revoke` (root token only; each
  refreshes the list). The Access page grows the issued-token table — name,
  scopes, created by, expiry, last used — with an issue form and revoke, shows
  the plaintext once and says so, and explains the 401 when the shell is
  running on a scoped token rather than the root. Both READMEs now recommend
  giving the shell a `read` token. Phase 8e-ui of
  `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [db925e5]
- Updated dependencies [db925e5]
  - @fonderie/client@0.29.0
  - @fonderie/vue-admin@0.5.0

## 0.4.0

### Minor Changes

- 0ea4938: Audit: the hook and the page
  
  `useAdminAudit` over `AuditAdminClient` (paged, `loadMore`), and
  `AuditScreen` under Activity in the shell, shown when `auditClient` is
  given: every workspace unless one is named, filterable by type and actor.
  The chain's integrity verdict lives on the Doctor page (`events.integrity`).
  Phase 8d-ui of `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [0ea4938]
- Updated dependencies [0ea4938]
  - @fonderie/client@0.28.0
  - @fonderie/vue-admin@0.4.0

## 0.3.0

### Minor Changes

- 3e069c9: Money: hooks and the Catalog and Subscriber pages
  
  `useAdminCatalog` (configured vs stored; `createPlan`, `updatePlan`,
  `deletePlan`) and `useAdminSubscriber` (subscription, wallet, paged ledger,
  `grant`) over `BillingAdminClient`. `CatalogScreen` and `SubscriberScreen`
  under a Money group in the shell, shown when `billingClient` is given. The
  one write on the subscriber page is a manual grant, idempotency-keyed per
  click. Phase 8c-ui of `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [3e069c9]
- Updated dependencies [3e069c9]
  - @fonderie/client@0.27.0
  - @fonderie/vue-admin@0.3.0

## 0.2.0

### Minor Changes

- 201f6af: Users: hooks and the People page
  
  `useAdminUser` (lookup by email or id; `suspend`, `unsuspend`,
  `revokeSessions`), `useAdminUserSessions`, `useAdminLoginHistory`
  (paged) over `AuthAdminClient`. `UsersScreen` in the shell under a People
  group, shown when `authClient` is given: the account, its live sessions and
  recent sign-ins, with suspend / unsuspend / sign out everywhere. Phase 8b of
  `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [201f6af]
- Updated dependencies [201f6af]
  - @fonderie/client@0.26.0
  - @fonderie/vue-admin@0.2.0

## 0.1.0

### Minor Changes

- fdae8f5: New package: the admin shell for Vue
  
  `AdminShell` — navigation by the operator's questions, seven pages over
  `@fonderie/admin` (Attention, Modules, Configuration, Doctor, Routes, Admin
  log, Access), and the existing config/secrets and template screens composed
  as sub-pages under the one admin token (their clients constructed with
  `prefix: '/_admin'`). Controlled or uncontrolled navigation. Each page is
  also exported on its own. Phase 7b of `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [fdae8f5]
  - @fonderie/client@0.25.0
