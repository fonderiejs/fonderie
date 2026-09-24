# @fonderie/admin

## 0.10.0

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

## 0.9.1

### Patch Changes

- 4e3f341: The admin UI no longer offers a Config page for a brick that is not installed
  
  Clicking "Config & secrets" crashed the dashboard with
  `Uncaught TypeError: a.map is not a function`, alongside a 404 on
  `/_admin/secrets`.
  
  The 404 was the harmless symptom. The crash was a **silent shape collision**:
  the served UI decided whether to show the page by probing the manifest for
  `/_admin/config` — a path `@fonderie/admin` registers ITSELF, as the
  declared-vs-held report. So the probe was true on every deployment. The shell
  built a `ConfigAdminClient`, `listConfig()` fetched `/_admin/config`, got
  **200** carrying admin's report OBJECT where it expected an ARRAY of config
  entries, and the screen died on `.map`.
  
  A 200 with the wrong shape is worse than a 404: nothing reports it.
  
  - The probe is now `/secrets`, which only `@fonderie/config` serves.
  - `useConfigEntries` / `useSecrets` (React and Vue) reject a non-array result
    instead of handing it to a component typed for a list, and say what is
    likely wrong: "is @fonderie/config mounted at this prefix?"
  
  A test in `@fonderie/admin` pins the invariant both ways — that this module
  owns `/_admin/config` (so probing it for another brick is a false positive)
  and does NOT own `/_admin/secrets` (so the new probe stays sound).
  
  **Separately, and NOT fixed here:** `@fonderie/config` describes `/config`,
  which `@fonderie/admin` already owns, so registering both modules fails boot
  with "cannot describe GET /_admin/config". That needs one of the two paths to
  move and is a breaking change for whichever loses.

## 0.9.0

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

## 0.8.3

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

## 0.8.2

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.8.1

### Patch Changes

- 19fddc6: `host` accepts a scheme or a trailing path instead of silently matching nothing
  
  `host` is compared against the request's `Host`, which is a bare hostname with
  an optional port — never a scheme. But the option sits beside config that *is*
  full URLs, so `https://admin.example.com` is the natural slip, and it used to
  go into the allow-set verbatim. It then matched no request at all: every route
  under the prefix answered 404, which is by design indistinguishable from the
  surface never having been mounted. A typo in optional hardening locked the
  operator out of their own dashboard with nothing to read.
  
  `https://admin.example.com`, `http://admin.example.com/`, `admin.example.com/`
  and `admin.example.com` now all name the same host. The boundary is unchanged —
  another hostname is still 404, and an entry given with a port is still exact.

## 0.8.0

### Minor Changes

- 7299a08: `host` — answer only for requests addressed to a hostname you name
  
  `AdminModule({ host: 'admin.example.com' })`, or a list. Every other host
  gets the same `404` an unmounted surface gives — deliberately not a `403`,
  which would confirm the surface exists and that you found the wrong door.
  Case-insensitive, port-optional unless you configure one, and it covers the
  served dashboard's two unguarded asset routes as well: serving a page that
  says "admin" on your public API hostname is precisely what this prevents.
  
  The concrete reason it exists: platforms hand every deployment a permanent
  URL of their own (`project-abc123.vercel.app`) that answers whatever your
  custom domain answers, walking around anything you put in front of the
  domain. Binding closes that hole while the rest of the app keeps serving on
  both hostnames.
  
  **It is not an access control**, and the option's doc comment says so.
  `Host` is client-set, so this only means something when the edge decides the
  hostname and your origin is not reachable around it — the same footgun
  `trustProxy` carries in `@fonderie/core`. A refused request is still logged,
  so the caller learns nothing and the operator learns something, and the
  manifest reports the binding as `admin.host` (client type updated to match).

## 0.7.0

### Minor Changes

- 38f2410: `ui: true` — serve the dashboard from the deployment itself
  
  `AdminModule({ ui: true })` serves `@fonderie/react-admin-screens` at
  `GET /_admin/ui`, compiled into one 82 KB-gzipped file that ships in this
  package. A deployment gets the whole operator surface with no frontend
  build and no new dependency — React and the screens are devDependencies
  here, bundled at publish time. Off by default.
  
  The two static routes are unguarded by design: a browser navigating to a
  page cannot send an `Authorization` header, and neither file carries data.
  The page asks for a token, keeps it in `sessionStorage` for that tab only,
  and sends it itself — so every request that reads anything is guarded and
  logged exactly as before. It reads the manifest first and builds a client
  only for bricks that described routes, so pages that would 404 never
  appear. The script path comes from the request, so it is correct under a
  `basePath`, a moved `path`, and a trailing slash.
  
  Phase 7c of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.6.0

### Minor Changes

- 0a5c5c7: Scoped tokens: issue, expire, revoke — without a redeploy
  
  The admin surface had one credential, the configured `adminToken`, and
  handing it to a dashboard meant handing over secret reveal and every
  mutation. Now, with a store and the package's new migration
  (`fonderie_admin_tokens`), the configured token is the **root** and can
  issue scoped tokens: `read` (every GET except under `/secrets`), `write`
  (every mutation, implies read), `secrets` (anything under `/secrets`,
  implies both). The scope a route needs is derived from the route itself.
  
  Only the hash is stored; the plaintext is shown once. A valid token short of
  the scope is 403; unknown, revoked or expired is the same 401 as missing.
  The root is the only credential that can issue or revoke — a scoped token
  can never mint one. In the admin log the actor becomes `token:<name>`.
  `GET /_admin/access/tokens` lists what was issued; `POST` issues, `DELETE
  /:id` revokes. Without a store nothing changes: root only, issuing off.
  Phase 8e of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.5.0

### Minor Changes

- 782cac2: `GET /_admin/config`, `/_admin/routes` and `/_admin/access/tokens` — the rest of Tier 0
  
  - **config**: readiness problems per module, and the *presence* of each
    environment variable the deployment reads — never the value. Bricks never
    read `process.env` (config is injected), so the app names them:
    `AdminModule({ env: [...] })`.
  - **routes**: every route with a guard class — `admin`, `probe`, or `app`.
    Whether an `app` route needs a session is not derivable here, so it is not
    claimed.
  - **access/tokens**: the admin token's readiness verdict, and which bricks
    still register a legacy standalone surface with their own token.
  
  Phase 6 of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.4.0

### Minor Changes

- 159d853: The admin log — every request through the surface, refused ones included
  
  Until now admin actions left no trace: nothing recorded who revealed a
  secret, changed a template or granted credits, and a wrong token was
  invisible. `AdminModule({ store })` and the package's migration add
  `fonderie_admin_log`: actor (`X-Actor`, else `admin-token`), method, path,
  route, module, status, duration, request id, client IP.
  
  The log middleware runs *before* the token guard, so a refused request is
  a row too; a failed write never fails the request it describes.
  `GET /_admin/activity/admin-log` reads it newest first, keyset-paged. The
  manifest reports `admin.log: false` when no store is given, so "not
  recording" is visible.
  
  `@fonderie/store` becomes an optional peer. Phase 5 of
  `docs/ADMIN-BRICK-DESIGN.md`.

## 0.3.0

### Minor Changes

- 2363ea6: `GET /_admin/doctor` and the attention page at `GET /_admin`
  
  The five reconciliation checks from `docs/OPERATIONS.md` had one home: a
  cron route in an example app, reporting through `console.error`. Now every
  brick that describes checks has them run at `/_admin/doctor` — on demand,
  each under `checkTimeoutMs` (default 10 s), a throw turned into a finding,
  never a 500. Two modules offering one check name fail boot, naming both.
  `AdminModule({ checks })` takes the ones no module owns, such as pending
  migrations.
  
  `GET /_admin` is what needs the operator today: readiness problems as
  reported, failed checks as errors, findings on passing checks as advice.
  `ok: true, items: []` is green.

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.0

### Minor Changes

- e687c4e: Mount every brick's described admin routes under the prefix
  
  `AdminModule` now reads `app.adminDescriptions()` and mounts each described
  route at `/_admin` + path, behind its own token — so config, courier and
  billing's admin surfaces appear at `/_admin/config`, `/_admin/secrets`,
  `/_admin/templates`, `/_admin/plans` and `/_admin/wallet/grant` with one
  token, whatever each brick's own `adminToken` is set to. Two modules
  describing the same route fail boot, naming both.
  
  The manifest gains `describesAdmin` per module, so a brick that offers
  nothing is distinguishable from one that has not implemented the contract.

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.1.0

### Minor Changes

- 981ee15: New brick: `@fonderie/admin` — the operator's surface
  
  The model that assembled the app knows what is installed, wired and
  configured. The human who deployed it does not, unless they are back in a
  development session and can ask. The answer already existed in core
  (`securityReport()`, `app.routes()`); it had no address.
  
  `AdminModule({ adminToken, path = '/_admin' })` owns one reserved prefix —
  no other module can mount under it, a collision fails boot — behind one
  admin token, fail-closed by absence and strength-checked at boot like every
  other brick's admin surface.
  
  `GET /_admin/manifest`: every registered module with its version (when it
  reports one) and its readiness problems, the aggregate readiness, and the
  full route table with the module that mounted each route. Readiness details
  are shown here in production, unlike the public `/readyz`, because the
  operator is the audience.
  
  Phase 2 of `docs/ADMIN-BRICK-DESIGN.md`. Bricks describing their own admin
  routes and checks (composition, doctor) come next.

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0
