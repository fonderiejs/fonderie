# @fonderie/vue-admin-screens

## 1.6.0

### Minor Changes

- b94ed53: The admin console speaks English, French and Spanish.
  
  The console's language is the OPERATOR's preference, independent of the locales the app serves its customers — a founder in France can run the console in French while every customer email stays English. It defaults to the browser's language, is stored per browser (`fonderie.admin.locale`), and is switched from the sidebar footer: a Language row with a menu (English / Français / Español, a check on the current one) above a Theme row with an icon-only System / Light / Dark control. The sign-in and onboarding screens carry the same controls, and a French or Spanish browser gets them in its language from the first screen.
  
  - `@fonderie/client`: `createAdminT(locale)`, `formatAdminDate`, `detectAdminLocale`, `ADMIN_LOCALES`, `adminLocaleNames` and the dictionaries — English canonical, French and Spanish typed against it, so a missing or extra key is a compile error; a test also checks every translation is non-empty and keeps the same `{placeholders}`.
  - Every console screen (React and Vue) takes an optional `locale` prop — `uiLocale` on `TemplateEditorScreen`, whose `locale` is the template's — and `AdminShell` passes it down. Omitted ⇒ English, so embedding apps are unaffected.
  - Dates follow the console language. Sign-in errors from known server reasons are shown translated; other server messages (check findings, validation from the API) stay as the server sends them.

### Patch Changes

- Updated dependencies [b94ed53]
  - @fonderie/client@1.9.0
  - @fonderie/vue-config-admin-screens@0.8.0
  - @fonderie/vue-courier-admin-screens@0.8.0

## 1.5.0

### Minor Changes

- 1a593bc: The admin console now does what the CLI does for config, secrets and templates — and no longer edits the wrong row.
  
  **Fixed — the console could act on a different row than the one clicked:**
  - Opening a config entry or secret dropped its environment: a production-only row opened (and saved over) the shared `all` value.
  - Revealing a secret revealed the list's scope, not the row's environment.
  - Opening a template dropped its locale: the French row opened, and saved, the default copy.
  - `@fonderie/store`: re-creating a key that had been deleted failed with a 500 — the new version 1 collided with the key's surviving revision history. It now continues after the last revision; history is kept.
  
  **New, matching the CLI:**
  - Delete for config, secrets and templates (behind the fresh-code prompt).
  - **Built-in emails cannot be deleted.** `@fonderie/courier` refuses to delete the default-locale row of a seeded or module-shipped template (409 `SYSTEM_TEMPLATE`) and marks those rows `system: true` in the list — they can be edited and rolled back only. Locale variants and app-added templates remain deletable. A test pins the seeded list to migration 002.
  - Environments: filter Config & secrets by environment; create an entry in a chosen environment.
  - Templates: "New template", and "Add locale" on a template (starts from the default copy).
  - Version checks on the config and template editors: a concurrent change shows a conflict with Reload instead of being overwritten.
  - Public config: keys served to frontends are marked "public", with a preview of exactly what `GET /config/public` returns.
  - Audit: from/to date filters. Billing: read a subscriber's wallet in another currency.

### Patch Changes

- Updated dependencies [1a593bc]
  - @fonderie/client@1.8.0
  - @fonderie/vue-config-admin-screens@0.7.0
  - @fonderie/vue-courier-admin-screens@0.7.0

## 1.4.0

### Minor Changes

- 2c350b5: Deleting an account now stops its billing, and purging it erases the payment provider's copy.
  
  Before: `@fonderie/auth` soft-deleted the user and emitted `fonderie.user.deleted`, but nothing listened — an active subscription kept renewing on a card the person could no longer sign in to cancel.
  
  - **Billing, on `fonderie.user.deleted`** (needs the event bus): cancels the user's subscription at the provider — immediately by default; `onSubscriberDeleted: 'cancel-at-period-end' | 'keep'` to change that — and disarms off-session charging (auto-recharge off, stored card and any pending recharge key forgotten). No automatic refund; the app decides. Workspace subscriptions are untouched. Idempotent: an "already canceled" answer from the provider is success, a real failure throws so the bus redelivers.
  - **Billing, on `fonderie.user.purged`:** deletes every provider customer record the user had (subscription and wallet customers) — the email and saved cards. The provider keeps its invoices; local subscriptions, ledger and balances stay as financial records keyed by an id that no longer resolves to a person. New optional provider method `deleteCustomer` (Stripe: `customers.del`, already-deleted is a no-op).
  - **Auth:** `purgeSoftDeletedUsers` / `startUserRetention` take an optional `bus` and emit `fonderie.user.purged` { userId } for each hard-deleted account, after the delete. `EVENT_KEYS.userPurged`. The admin user lookup by id resolves soft-deleted accounts (with `deletedAt`); `GET /_admin/users?deleted=1` lists only them.
  - **Client / hooks:** `listUsers({ deleted: true })`; `useAdminUsers` passes it through.
  - **Console:** Users gets an Active / Deleted switch; a deleted account shows "Deleted on …" instead of account actions, sessions and sign-ins, and keeps its Plan & credits.

### Patch Changes

- Updated dependencies [2c350b5]
  - @fonderie/client@1.7.0
  - @fonderie/vue-admin@1.2.0

## 1.3.1

### Patch Changes

- 42f52ae: Opening a subscriber whose account no longer exists (deleted or purged, billing rows left behind) showed "No user with that email." — wrong on two counts: the lookup was by id, and the page dead-ended. It now says "No account with id … — it was deleted, or never existed here. Its billing records remain." and still shows that subscriber's plan, credits, grant form and ledger.

## 1.3.0

### Minor Changes

- eb90854: Billing lives on the user. Every user is billable — a wallet needs no subscription, and no subscription means the free tier — but the Subscriber page listed only people with a subscription, so free users could not be found to grant credits.
  
  - **Users:** a Plan column (plan name, or "free"), and a "Plan & credits" section on each user: plan and status with renew/end date, credit balance, the grant form and the ledger. `UsersScreen` takes optional `billingClient` and `openUserId`.
  - **Subscriptions** (was "Subscriber"): a money list — who pays, who is behind — with status filters and counts, and a "Renews / ends" column. Opening a user subscriber goes to their user page; workspace subscribers open in place. `SubscriberScreen` takes `onOpenUser`.
  - **Fixes:** a canceled subscription said "Renews"; it now says "Ends" or "Ended". The credit breakdown read "granted 0 · purchased 5" after an admin grant; it now reads "5 permanent · 0 plan allowance" (admin grants and purchases never expire; the plan allowance can).
  - New shared `SubscriberBilling` component in both packages.

## 1.2.0

### Minor Changes

- 431aa20: Operator accounts for the admin console: people sign in with email, password and a mandatory authenticator app instead of pasting a token.
  
  A token is a shared secret with no name on it — pasted into chat, saved in notes, logged as "admin-token". With a `store`, `@fonderie/admin` now has operators:
  
  - **No registration.** The first operator is claimed once with the root `adminToken`; every other one is invited by an Owner through a single-use, expiring link. Operators live in their own table — an app sign-up or an app account takeover can never produce one.
  - **Mandatory second factor.** RFC 6238 codes with a replay guard, QR enrollment, ten single-use backup codes shown once. Secrets sealed at rest with the new `operatorKey` (64 hex).
  - **Step-up.** Revealing a secret, minting a token or link, applying a migration and deleting need a code from the last five minutes; the console prompts and retries the action.
  - **Sessions.** HttpOnly SameSite=Strict cookie (`__Host-` over HTTPS), 30 min idle / 12 h absolute, rotated at every privilege change, same-origin writes only. Lockout after 5 failures plus a per-address limit; generic errors.
  - **Recovery without email.** Backup codes, a recovery link from another Owner, or the root token from the terminal (`fonderie admin operator recover <email>`) as the break-glass.
  
  `adminToken` remains the machine credential and the break-glass. `operators: false` keeps the token gate. New client methods on `AdminClient` (`session`, `login`, `verify`, `stepUp`, `inviteOperator`, …, and `adminToken` is now optional for cookie use), hooks `useAdminSession` / `useAdminOperators` (React and Vue), an Operators page in both screen packages, and `fonderie admin operator invite|recover|disable|enable`.

### Patch Changes

- Updated dependencies [431aa20]
  - @fonderie/client@1.6.0
  - @fonderie/vue-admin@1.1.0

## 1.1.0

### Minor Changes

- a2a9a65: A modernized admin console. Same pages, same data, a surface that reads like a product instead of a text document.
  
  - **Shell:** sidebar with the deployment's host and an environment badge (production is tinted), an icon per page, and the session controls (theme, forget token) docked in its footer instead of floating over content. Below 820px the sidebar becomes a drawer behind a top bar. New optional `AdminShell` props: `appName`, `envLabel`, `footer`.
  - **Pages:** a header on every page saying what it answers, with its actions on the right. Tables and lists are framed cards. Status is a pill (ready / error / advice / skipped) rather than a coloured word. Attention opens with summary tiles (needs action, advice, modules ready, routes). Routes filters as you type. Empty states say what would appear.
  - **Served console:** a sign-in card; the page lives in the URL hash, so reload, bookmarks and back work; hover, focus rings and phone padding from the shell stylesheet.
  - **Config and templates screens** match: framed lists, pill status, card forms, consistent controls.
  
  Every colour is still a `--fonderie-*` token with a light fallback (checked against the served bundle), so embedded screens keep rendering without the shell, and there is still no webfont or icon font — icons are inline SVG paths.

### Patch Changes

- Updated dependencies [a2a9a65]
  - @fonderie/vue-config-admin-screens@0.6.0
  - @fonderie/vue-courier-admin-screens@0.6.0

## 1.0.2

### Patch Changes

- cc51775: Admin editors that respect the operator's time.
  
  - **Templates:** the preview sits to the right of the editor and stays pinned
    while the form scrolls (it used to wrap below the fold), and it is always
    live — re-rendered 500 ms after the last edit instead of on a Render click.
    Save is disabled with "No changes to save" until the content differs from
    what is stored.
  - **Config & secrets:** the page had no way to create an entry and rendered
    bare headings when empty. It now has an empty state and **New entry** /
    **New secret** buttons; creating refuses an existing key rather than
    overwriting it. Values are edited by type — Text, Number, On/off or JSON —
    instead of raw JSON, and a value that does not parse shows why (it used to
    fail silently). The list shows each entry's type and value.
  - **client:** `castConfigValue`, `configValueType`, `formatConfigValue`,
    `configKeyProblem` and `CONFIG_VALUE_TYPES` — the typed-value rules the
    editors use, shared so feature-flag hooks can use the same casting.
- Updated dependencies [cc51775]
  - @fonderie/client@1.3.0
  - @fonderie/vue-courier-admin-screens@0.5.0
  - @fonderie/vue-config-admin-screens@0.4.0

## 1.0.1

### Patch Changes

- 3446009: Auth events can say where they came from. `IAuthConfig.location` is an
  optional resolver `({ ip, headers }) => IRequestLocation | null`, called at
  most once per request. Its result is stored on every login-attempt row, on a
  new `registration` row written at sign-up, and on each new session (nullable
  `location` JSONB columns — migrations 018 and 019, run your migrations), and
  returned as `location` on login-history events and active sessions. Absent
  resolver ⇒ `location: null`, behaviour unchanged apart from the new
  `registration` rows in login history.
  
  Registration is recorded because with verification not enforced the account
  is live from that request: it is the first record of where the user came from.
  
  Auth imports no geo code: on Vercel/Cloudflare pass
  `({ headers }) => geoFromHeaders(headers, { trust })` from `@fonderie/geo`; a
  self-hosted table or an IP-intelligence API fits the same contract and may add
  ISP/ASN/proxy/hosting. Output is treated as untrusted: type-checked and
  bounded, coordinates rounded to ~1 km, re-sanitized on read;
  a resolver that throws or exceeds 500 ms leaves the row without a location.
  
  Client: `IRequestLocationDTO`, `location` on `ILoginEventDTO` and
  `ISessionDTO`, and `describeLocation(loc, countryName?)` ("Mountain View, CA, US");
  the auth hook packages re-export the type. The admin console shows location
  next to the IP for live sessions and recent sign-ins, with a proxy/VPN or
  hosting flag when known.
  
  Postal / ZIP code is kept when the resolver knows it (`postalCode`), and
  `@fonderie/geo`'s `geoFromHeaders` now reads it from Vercel's
  `x-vercel-ip-postal-code` and Cloudflare's `cf-postal-code`. It is approximate
  for an IP, so `describeLocation` leaves it out of the one-line display.
- Updated dependencies [8983e77]
- Updated dependencies [3446009]
  - @fonderie/client@1.1.0

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
  - @fonderie/vue-admin@1.0.0

## 0.8.0

### Minor Changes

- 615525d: Theme the admin console with the organisation's design tokens.
  
  The console is the surface an operator judges the product by, and it looked
  assembled: seven files carried their own greys, so the same border was `#ddd`
  on one screen, `#e0e0e0` on another and `#eee` on a third, and the token gate
  shipped a different font stack from the pages behind it.
  
  Colour, type, radii and shadow now come from `var(--fonderie-*)`, declared once
  in the served shell. Two consequences beyond the look:
  
  - **Dark mode works.** It never did — the near-white `#ddd`/`#eee` borders and
    the `#f9fafb` code block would have drawn bright lines and panels on a dark
    page. The shell now ships a dark palette under `prefers-color-scheme`, scoped
    `:root:not([data-theme="light"])` so an explicit light choice still wins.
  - **The surface is themeable.** Override any `--fonderie-*` variable on an
    ancestor and the console follows. The prefix is namespaced deliberately: the
    dashboard can be embedded in a consumer's own page, and a bare `--color-text`
    would collide with theirs silently, and only in their app.
  
  Every variable carries a light-palette fallback, because these screens are
  published packages: imported into an app with no Fonderie shell, an unresolved
  `var(--fonderie-text)` yields nothing at all — invisible text, invisible
  borders. With fallbacks an embedded screen renders correctly and is simply not
  themed.
  
  No webfont is fetched. The tokens name Inter first and fall through to the
  system stack, so an admin console does not announce its existence to a third
  party and still works on an air-gapped deploy.
  
  **Theme switcher.** The console offers System / Light / Dark, the same control
  as the organisation UI (markup, icons and CSS copied from its `.theme-switch`).
  Until now "dark" was decided entirely by the OS: there was no rule for forcing
  dark on a light machine and no way to opt out of dark on a dark one. The shell
  gains `:root[data-theme="dark"]` alongside the existing media query, and the
  choice is stored under a namespaced `fonderie.admin.theme` key — the bare
  `theme` key would read and write a host app's own preference on a shared origin.
  
  "System" is the *absence* of `data-theme`, not a snapshot of the OS resolved at
  click time, so system mode keeps following the machine when it flips at sunset
  rather than freezing until reload. An inline boot script applies a stored choice
  before first paint; if it is blocked or storage throws, the console falls back to
  system — the default either way.
  
  **Chrome moved to the corners.** "Forget token" used to sit in a full-width
  strip above the whole console, which spent a band of vertical space on one
  button and pushed the sidebar down from the top edge. The strip is gone: the
  session control docks bottom-left, the theme switcher bottom-right, and the nav
  now reaches the top of the page.

### Patch Changes

- Updated dependencies [615525d]
  - @fonderie/vue-config-admin-screens@0.3.0
  - @fonderie/vue-courier-admin-screens@0.4.0

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
  - @fonderie/vue-admin@0.7.0

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
