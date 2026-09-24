# @fonderie/vue-admin

## 1.0.0

### Major Changes

- 70e74b4: **Breaking:** the admin console's config report is now the *environment* report.
  
  `@fonderie/admin` registered `GET /_admin/config` for a payload that has never
  been configuration: readiness problems per module, and which **declared env
  vars are set**. That is a deployment report.
  
  Holding the name had two costs.
  
  `@fonderie/config` describes `GET /_admin/config` for real config entries, so
  registering both modules **failed boot outright**, in either order:
  `[fonderie] @fonderie/config cannot describe GET /_admin/config`. The config
  brick could not be used alongside the admin console at all — its "Config &
  secrets" page was unreachable by construction.
  
  The misnomer also caused a production crash. The served UI probed `/config` to
  decide whether the config brick was mounted; because admin owned that path the
  probe was true on every deployment, so the shell built a `ConfigAdminClient`
  whose `listConfig()` received admin's report *object* where it expected an
  *array*, and the page died on `entries.map(...)`.
  
  | before | after |
  |---|---|
  | `GET /_admin/config` | `GET /_admin/environment` |
  | `AdminClient.config()` | `AdminClient.environment()` |
  | `useAdminConfig` | `useAdminEnvironment` |
  | `IUseAdminConfigReturn` | `IUseAdminEnvironmentReturn` |
  | `ConfigScreen` / `IConfigScreenProps` | `EnvironmentScreen` / `IEnvironmentScreenProps` |
  | `IAdminConfigReport` | `IAdminEnvironmentReport` |
  | `AdminPage` member `'config'` | `'environment'` |
  | nav label "Configuration" | "Environment" |
  
  No deprecation alias is possible: freeing the path *is* the fix, so serving it
  under both names would preserve the collision.
  
  `@fonderie/config` and its screens packages are unchanged — they keep
  `/_admin/config` and `/_admin/secrets`, which is the point.
  
  Migration is a rename. If you called `AdminClient.config()`, call
  `.environment()`; if you imported `useAdminConfig` or `ConfigScreen`, import the
  `Environment` names. Nothing in this repo's examples used any of them.

### Patch Changes

- Updated dependencies [70e74b4]
  - @fonderie/client@1.0.0

## 0.7.0

### Minor Changes

- 5e5cc5c: Apply pending migrations from the admin panel, per module, additive only
  
  The surface could already say a module was behind — the `app.migrations` check
  has reported it on the doctor and attention pages since the panel shipped. It
  could not do anything about it: applying meant `npm run migrate` from somebody's
  laptop, which is exactly the production DDL-by-hand this surface exists to
  replace.
  
  `GET /_admin/migrations` now reports every module's pending files **with their
  impact**, and `POST /_admin/migrations/:module/apply` applies one — all of its
  pending migrations, or none.
  
  **It refuses anything that deletes data.** `classifyMigration` labels each
  pending file; a module holding a `DROP`, `TRUNCATE` or `ALTER COLUMN … TYPE` is
  not appliable here and the panel names the offending statement and says to use
  CI or `npm run migrate` instead. There is no override — dropping a column should
  not be one click behind an admin token.
  
  **It refuses out of order.** Migration order is the app's, declared in one
  constant, and sets depend on each other across it — auth owns `fonderie_users`,
  which app migrations extend. A module sitting behind an unapplied one reports
  `blockedBy` and says which to apply first, so the operator walks the declared
  order and the UI cannot construct an out-of-order apply.
  
  **It refuses a set that changed under you.** The request carries the pending
  filenames the operator was shown; if a deploy has since changed them, the server
  answers 409 rather than applying something nobody reviewed.
  
  **It never reports an outcome it did not re-read.** Each migration commits in
  its own transaction, so a request that dies partway really did apply some files.
  The handler re-reads after `run()`, and the hooks refresh after a failure as
  well as a success — a timeout and a refusal must not look alike.
  
  A first install is exempt from the destructive rule: with no
  `fonderie_migrations` rows there is nothing to lose, the same judgement the CLI's
  `migrate --check` makes.
  
  Opt in by passing your migration sequence: `new AdminModule({ …, migrations:
  MIGRATION_STEPS })`. Without it the routes are not registered — this surface
  must never infer an order the app owns.

### Patch Changes

- Updated dependencies [5e5cc5c]
  - @fonderie/client@0.31.0

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
  - @fonderie/client@0.29.0

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
  - @fonderie/client@0.28.0

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
  - @fonderie/client@0.27.0

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
  - @fonderie/client@0.26.0

## 0.1.0

### Minor Changes

- e8eb04c: New package: Vue composables over `@fonderie/admin`
  
  One per page — `useAttention`, `useManifest`, `useDoctor`,
  `useAdminConfig`, `useAdminRoutes`, `useAdminTokens`, `useAdminLog`
  (keyset-paged, `loadMore`). Each takes the `AdminClient`; nothing stores
  the token. The shell that composes these with the existing config and courier
  admin screens is the next phase (`docs/ADMIN-BRICK-DESIGN.md` §9, phase 7).

### Patch Changes

- Updated dependencies [e8eb04c]
  - @fonderie/client@0.24.0
