# @fonderie/core

## 0.10.3

### Patch Changes

- 620b4fa: Cap declared-oversize bodies of ANY content-type in the body parser, not just json/form. The parser only reads (and streamed-caps) json and url-encoded bodies; a `multipart/form-data` upload was handed to the route uncapped — on an adapter with no transport-level cap (adapter-hono on node-server) a route buffering that upload was an unbounded-memory DoS. The parser now rejects any body whose Content-Length exceeds `maxBodyBytes` with `413`, regardless of type (the chunked/no-Content-Length streaming case remains the consuming route's responsibility).

## 0.10.2

### Patch Changes

- 6724b28: Two hardening fixes from the audit-2 residual backlog. (1) adapter-koa no longer silently drops request bodies when koa-bodyparser isn't installed: `koaContextToWeb` is now async and reads the socket stream itself (capped at `DEFAULT_MAX_BODY_BYTES`, configurable via `bridge`/`mount` `{ maxBodyBytes }`) when `rawBody` is absent, returning `413` for an oversize declared body. The adapter no longer hard-depends on koa-bodyparser. (2) core: `defaultErrorHandler` only leaks the raw error message when `NODE_ENV` is explicitly `development` or `test` — previously any non-`production` value (including `staging`) leaked messages that can carry connection strings/PII; unknown/unset envs are now treated as production-safe. (3) core router: a malformed percent-encoding or a decoded NUL byte in a path parameter now yields a clean 404 (no match) instead of a 500, and blocks a NUL-injection primitive for downstream consumers.

## 0.10.1

### Patch Changes

- 6352106: Fix a request stall on multi-MiB bodies in every adapter bridge, and stop swallowing parser short-circuits. All three bridges `clone()`d the request before `buildContext()` — undici's tee applies backpressure from the slower branch, so fully reading one branch while the other sat unread stalled any body past the stream's high-water mark (a legal 4 MiB upload hung forever; surfaced by the new in-parser body cap's tests). The bridges now let `buildContext` consume the body — core's parser re-materializes `ctx.request` from the buffered bytes — and `mount()`/infra fallbacks reuse that request. `buildContext` also surfaces a global-middleware short-circuit on `ctx.meta['pipelineResponse']` (previously discarded), so the parser's `413 PAYLOAD_TOO_LARGE` now actually reaches the client through every adapter. The adapters require core ≥0.10.1 for this contract.

## 0.10.0

### Minor Changes

- be7a6e7: Harden the request pipeline (audit №2). (1) The 5 MiB body cap now lives in the body parser itself (`bodyParser(maxBytes)`, honoring `config.maxBodyBytes`) instead of only `listen()`'s transport — so EVERY adapter's `buildContext()`/`handle()` path inherits it; previously an adapter without its own transport cap (adapter-hono) buffered unbounded bodies (memory-exhaustion DoS). Oversize bodies get `413 PAYLOAD_TOO_LARGE` (new `HTTP.PAYLOAD_TOO_LARGE` constant). The parser also stops `clone()`-ing the request — a tee with an unread branch stalled bodies larger than the stream's high-water mark — and re-materializes `ctx.request` after the capped read so raw-body readers (webhook signature checks) keep working. (2) The built-in `listen()` server no longer crashes the process on hostile request lines (`TRACE`, absolute-form request-targets): the handler is fully guarded and answers 400. Oversize responses now send the 413 before dropping the connection. (3) `/readyz` omits the `problems` list in production (it names weak secrets and placeholder tokens — a security-posture map); probes only need the status code. Opt back in with `exposeReadyzDetails: true`; non-production always includes details. (4) `withCors`: denied origins omit the `Access-Control-Allow-Origin` header entirely (an empty value is invalid), and reflected origins emit `Vary: Origin` so shared caches can't serve one origin's ACAO to another.

## 0.9.0

### Minor Changes

- 2a22d14: Cap the request body in the built-in `listen()` server (DoS guard). The Node server previously buffered the entire request body into memory with no limit, so a single unauthenticated request could exhaust memory before any handler ran. Bodies are now capped at 5 MiB by default (`DEFAULT_MAX_BODY_BYTES`, exported) — the same default the adapters use — with a Content-Length fast path that rejects declared-oversize bodies before reading a byte and a streaming backstop for chunked/lying lengths. Oversize requests get `413 PAYLOAD_TOO_LARGE`. Configure via the new `maxBodyBytes` config option (adapter deployments keep configuring the cap on the adapter instead).

## 0.8.0

### Minor Changes

- ca7777f: Default email templates: mechanism + resolver fallback chain (P0 — behavior-neutral).
  
  Groundwork so every module that emits customer notifications can ship a **default template** that renders out of the box, before any app override — closing the gap where a missing template silently delivered a raw JSON dump to the customer.
  
  - **`@fonderie/core`** adds the `IDefaultTemplate` type (`{ subject?, text, html? }`) — the shape a module's built-in copy takes. It lives in core (like `ICourierMessage`) so modules declare defaults without importing `@fonderie/courier`.
  - **`@fonderie/courier`** adds:
    - `DefaultTemplates` (a merged lookup over the module-shipped maps) and `renderFragment` (factored from the DB-row render path, so a default renders byte-identically to a DB row — same `{{var}}` interpolation, same layout composition).
    - A **fallback chain** in both `FSTemplateResolver` and `DBTemplateResolver`: **app override (DB row / FS file) → module default → last-resort JSON dump**. A per-key app override always wins; the JSON dump is now reached only for a type neither the app nor any module provides.
    - `ICourierConfig.templates.defaults?: DefaultTemplateMap | DefaultTemplateMap[]` — the app hands courier each module's `DEFAULT_TEMPLATES` (aggregated like `getMigrationsPath()`); `createTemplateResolver` wires them into both resolvers. No courier→module import — only the core *type* is shared, so no dependency cycle.
  
  **Behavior-neutral:** with no `templates.defaults` configured, `DefaultTemplates` is empty and both resolvers fall through to the JSON dump exactly as before. No module ships default content in this change — that lands per-module (auth, workspaces, billing) on top of this mechanism, each map constrained by `satisfies Record<ItsMessageKey, IDefaultTemplate>` so a missing key is a compile error.

## 0.7.0

### Minor Changes

- f3656f8: Consolidate three cross-package duplications into shared @fonderie/core primitives (from the consolidation audit).
  
  - **`constantTimeEqual(a, b)`** (new core export) — the one timing-safe compare. Replaces byte-identical copies in auth (MFA/TOTP codes), events (event-log HMAC), courier (SendGrid/Mailgun webhook-signature verification), and core's own admin-token guard. Prevents any copy silently dropping the length-guard or swapping to `===` and reintroducing a per-module timing side-channel.
  - **`secretStrengthProblem` / `PLACEHOLDER_SECRET` / `MIN_SECRET_LENGTH`** (new core exports) — one weak/placeholder-secret denylist. auth's `jwtSecret`/`clientSecret` checks and core's `validateAdminToken` now share it (the two regexes had already drifted by one term). Call-site policy (required vs optional, field name) stays per-module.
  - **`encodeKeysetCursor` / `decodeKeysetCursor`** (new core exports) — one keyset-pagination cursor over `(created_at, id)`. billing's wallet ledger and audit's event log now share it. **Fixes a real bug in `@fonderie/audit`**: its local decode lacked timestamp field-range checks, so a crafted in-shape-but-out-of-range cursor reached the `::timestamptz` cast as a **500**; it now decodes to null (the model drops the keyset predicate and returns the first page) instead of 500ing. audit's opaque cursor wire format changes to the shared one (in-flight cursors restart pagination — acceptable for an opaque cursor).
  
  Behavior-preserving elsewhere (billing's public `encode/decodeLedgerCursor` are kept as aliases; auth also adopts the existing `dateOrEmpty` for session/user timestamps, fixing a latent `''`-for-string-input inconsistency). Adversarially reviewed; no public API removed.

## 0.6.0

### Minor Changes

- 0f0ca59: Unify admin-route authentication into one shared primitive (see docs/ADMIN-AUTH-SPEC.md).
  
  Every module with an ops/admin surface (billing plan-writes + wallet-grant, config/secrets admin, courier template admin) previously shipped its own hand-rolled Bearer guard — three byte-identical copies of `safeTokenEqual` + the guard, with no guarantee they stayed in sync.
  
  - **`@fonderie/core`** now exports `requireAdminToken(adminToken)` and `validateAdminToken(token, { module })` from `@fonderie/core/middlewares` — the one constant-time Bearer guard and the one admin-token strength rule (min 32 chars, reject placeholders). Core depends on nothing, so there is no cycle.
  - **`@fonderie/billing`** and **`@fonderie/courier`** delete their local guard copies and adopt the shared one, and — the real fix — now call `validateAdminToken` in `checkReadiness()`, so a weak/placeholder admin token guarding `/plans` + `/billing/wallet/grant` or `/admin/templates` is a **production readiness error** (previously only `@fonderie/config` enforced this; billing/courier accepted a `changeme` token).
  - **`@fonderie/config`** drops its duplicate guard + strength logic for the shared core versions — behavior-identical, no observable change.
  
  No route paths, methods, request/response shapes, or config fields change. `requireAdminToken` behavior (Bearer, constant-time, `401 UNAUTHORIZED / "Missing or invalid admin token"`) is preserved exactly.

## 0.5.0

### Minor Changes

- b1d053c: Freeze-prep: sync the `IFonderieApp` contract with `FonderieApp` and enforce it.
  The interface modules receive in `install(app)` was missing `boot()` and
  `checkProductionReadiness()` — both are public on the class and part of the app
  lifecycle — so a module typed against `IFonderieApp` couldn't call them. Added
  both to the interface and made `FonderieApp implements IFonderieApp` so the two
  can never silently drift again. Also removed a stale comment referencing a
  `@fonderie-labs/auth` scope that isn't the plan; `ITenant`/`IAuthUser`/
  `IWorkspace` are documented as the real core-owned identity contracts (auth and
  workspaces populate them on the context). Additive — no consumer break.
- dfdcebb: Freeze-prep: drop `_router` from `IFonderieContext`. The field was written onto
  every context but **never read** anywhere — routing dispatches through
  `routerMiddleware(router)`, which closes over the router directly. It only
  leaked router internals into the (soon-to-be-frozen) public context contract and
  forced every context-constructing adapter/test to carry `_router: null as any`
  boilerplate. Removed from the interface, from both core construction sites, and
  from the four adapter/billing test fixtures. No behaviour change.

## 0.4.0

### Minor Changes

- 2d4dac8: Add `app.checkProductionReadiness()` — one call that aggregates every module's
  config footguns into a structured report (`{ ok, problems[] }`) you can gate a
  deploy on or expose from a readiness endpoint, instead of relying on scattered
  boot-time warnings. Modules opt in via an optional `IFonderieModule.checkReadiness()`;
  core aggregates without importing them (`ok` is false on any `error`-severity
  problem). Auth reports a weak/placeholder `jwtSecret` (error) and
  `secureCookies: false` (warning); courier reports message types routed to a
  channel with no provider (warning). The existing auto-guards (auth fails closed
  in production, courier warns at boot) are unchanged — this adds the inspectable
  data path alongside them.

## 0.3.0

### Minor Changes

- 6e9f785: Production-grade, composable email templates. Templates are now **body
  fragments** injected into a shared branded layout shell (`templates/layout.ts`)
  — a cross-client-hardened responsive frame (max-width card, hybrid inline +
  `<style>` CSS, mobile media query, Outlook VML shim) with a small retunable
  theme token set (`EMAIL_THEME`). One shell, many bodies: the DB and FS resolvers
  both compose it, so every transactional email renders the same frame for free.

  Seeds now ship the templates auth and workspaces actually send —
  `email-verification`, `password-reset`, `workspace-invitation`, `email-changed`
  (previously only `email-verification` was seeded; the rest fell through to a raw
  JSON debug fallback). Founders can override the whole shell by storing a
  `_layout` template (DB row or `_layout.html` file); a template that is already a
  full HTML document is passed through untouched (never double-wrapped).

  Localization is now wired end-to-end. `IAuthUser` carries the user's `locale`
  (sourced from the DB row via the session middleware), and every auth/workspaces
  notification emit now stamps `locale` on the courier message so per-locale
  templates are actually selected. The resolver's locale lookup was made
  region-safe: it serves the **exact** locale or the neutral `NULL` default and
  **never a sibling region** (`en-CA` will not fall back to `en-US`) — the SQL now
  uses `locale IS NOT DISTINCT FROM $2` ordering plus a `(locale = $2 OR locale IS
NULL)` filter, so legal/jurisdictional copy can't bleed across regions.
  Workspace invitations intentionally omit `locale` (the invitee's language is
  unknown at invite time) and fall to the neutral default.

## 0.2.0

### Minor Changes

- bbd3e9a: `FonderieApp.listen()` now returns the underlying `http.Server` (previously `void`), so you can await `listening`, close it for graceful shutdown, or hand it to a supertest-style harness. Adds a `quiet` option to suppress the startup banner (tests / quiet deploys). Backward compatible — existing `app.listen(port)` calls are unaffected. This also unblocks a regression test proving the built-in server forwards multiple `Set-Cookie` headers (the cookie fix from #55/#56).
- f18ac65: Add `onResponse` — an opt-in config hook to adapt Fonderie's response contract. It transforms every JSON response body at the single egress point (adapter-agnostic; status, headers, and cookies preserved), so an app can serve its own shape — e.g. flatten Fonderie's `{ reason, explanation, result: { tokens, user } }` into a frontend's expected `{ user, accessToken, refreshToken }` — without editing any handler. Unset = unchanged behaviour. Surfaced by the client-app rewrite (Phase 1): the response envelope was the single biggest contract divergence, and this closes it with one config option instead of a per-app adapter, moving existing-frontend adoption toward drop-in.

### Patch Changes

- e4d9bb2: Complete the auth-cookie fix across every response egress. The same `Set-Cookie` mangling fixed in `@fonderie/adapter-express` also existed in `@fonderie/adapter-koa` and in `@fonderie/core`'s built-in `app.listen()` HTTP server: forwarding headers with `forEach` + `set()`/`setHeader()` overwrites all but the last `Set-Cookie`, so cookie-based auth silently broke there too. Both now forward the full list via `getSetCookie()`. `@fonderie/adapter-hono` was already correct (it returns the Web `Response` natively). Found by auditing sibling packages after the express fix.

## 0.1.5

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 0.1.4

### Patch Changes

- 4b2074d: Refactor the private/loopback IP check in `resolveClientIp`'s proxy-config
  detection into named constants (`LOOPBACK_IPS`, `PRIVATE_IP_PREFIXES`,
  `CGNAT_OR_RFC1918_172`) instead of an inline `||` chain — same behavior,
  clearer intent, and now covered by tests (all RFC1918/link-local/ULA ranges
  warn; public IPs don't).

## 0.1.3

### Patch Changes

- 237777a: New package **@fonderie/rate-limit** and default brute-force protection in auth.

  - `@fonderie/rate-limit`: an atomic token-bucket limiter with three
    interchangeable stores — `MemoryStore` (single instance), `StoreAdapterStore`
    (distributed over Postgres via one `INSERT … ON CONFLICT` upsert), and
    `RedisStore` (one Lua `eval`, no Redis dependency — structural client). Emits
    IETF `RateLimit-Limit`/`-Remaining`/`-Reset` + `Retry-After`. Ships a
    `migrations/` subpath for the Postgres backend.
  - `@fonderie/auth` now rate-limits login, registration, password reset, and
    MFA verification **by default**, backed by the module's own store adapter —
    distributed-correct across instances with zero configuration. Login uses
    dual limits (per-IP and per-account). Tune via the new `rateLimit` config
    field, inject a `RedisStore` for scale, or set `rateLimit: false`.
  - `@fonderie/core` + adapters: `resolveClientIp()` populates
    `ctx.meta.clientIp` with explicit proxy trust (`TRUST_PROXY`), which the
    limiter's `byIp()` keying consumes.

## 0.1.2

### Patch Changes

- One request-validation layer across every endpoint-exposing package:

  - `validate(schema)` middleware in `@fonderie/core/middlewares` (structural
    `safeParse` interface — core stays dependency-free)
  - zod request schemas on all 43 body-taking routes across auth, workspaces,
    billing, customers, and webhooks; invalid input returns 422
    `INVALID_PARAMETER` with a field path before the controller runs; parsed
    bodies are trimmed and stripped of unknown keys
  - schemas exported per package (`schemas.*`) so docs generators and typed
    clients read the same contract the runtime enforces
  - provider-shaped webhooks (`/billing/webhook`, `/courier/delivery/*`) are
    deliberately exempt — gated by signature verification instead

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
