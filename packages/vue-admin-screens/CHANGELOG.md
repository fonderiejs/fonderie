# @fonderie/vue-admin-screens

## 0.6.0

### Minor Changes

- 3aab737: The Users page lists on arrival instead of demanding an email first
  
  `GET /_admin/users` required `?email=` and answered 422 without it, so the
  operator screen opened as an empty box: you could only see an account you could
  already name. Nobody can answer "who signed up this morning" that way, and it
  is the opposite of what an operator surface is for.
  
  Without `email` the route now returns a keyset-paginated page, newest first —
  the same cursor contract as login history and the audit log, `{ users,
  nextCursor }`. With `email` it is the exact lookup it always was, unchanged.
  Not a new route, so the token scope stays `read`, derived as before.
  
  Ships `AuthAdminClient.listUsers()`, `useAdminUsers` for React and Vue, and the
  Users screen listing with Load more; clicking a row, or looking up an email,
  opens the account detail as before.
  
  Includes an index on `fonderie_users (created_at DESC, id DESC)` — **run the
  auth migrations**. Keyset paging orders by that pair and the table had only an
  email index, so every page would otherwise sort the whole table.
  
  The list is the same allowlist DTO as the lookup: `passwordHash` and
  `mfaSecret` cannot appear, and a test asserts it against the list response too.
- 3bf1669: The Subscriber page lists on arrival instead of asking for a type and an id
  
  `GET /_admin/subscriptions` returns a keyset-paginated page of subscribers,
  newest first — `{ subscriptions, nextCursor }`, the same cursor contract as the
  wallet ledger. The existing `/subscriptions/:type/:id` lookup is unchanged.
  
  The screen opened as an empty form asking for a subscriber type and id, which
  is answerable only if you already knew both. Now it lists, and a row opens the
  detail view — subscription, wallet, ledger and the manual grant — exactly as
  before.
  
  `limit` is clamped strictly (`NaN`, `<1` or `>100` ⇒ 422) and a malformed
  cursor is 422, matching how the wallet ledger behaves in this package rather
  than auth's and audit's silent clamp.
  
  Includes an index on `fonderie_subscriptions (created_at DESC, id DESC)` —
  **run the billing migrations**. The table carried no index at all: every read
  so far was by subscriber, which a small mirror serves from a scan, but a keyset
  page is a range scan and would otherwise sort the whole table each time.
  
  Ships `BillingAdminClient.listSubscriptions()`, `useAdminSubscribers` for React
  and Vue, and both Subscriber screens listing with Load more.

### Patch Changes

- Updated dependencies [2530bf1]
- Updated dependencies [3aab737]
- Updated dependencies [3bf1669]
  - @fonderie/client@0.30.0
  - @fonderie/vue-courier-admin-screens@0.3.0
  - @fonderie/vue-admin@0.6.0

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
