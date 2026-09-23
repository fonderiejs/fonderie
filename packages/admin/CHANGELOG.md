# @fonderie/admin

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
