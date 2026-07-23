# @fonderie/core

## 0.2.0

### Minor Changes

- bbd3e9a: `FonderieApp.listen()` now returns the underlying `http.Server` (previously `void`), so you can await `listening`, close it for graceful shutdown, or hand it to a supertest-style harness. Adds a `quiet` option to suppress the startup banner (tests / quiet deploys). Backward compatible — existing `app.listen(port)` calls are unaffected. This also unblocks a regression test proving the built-in server forwards multiple `Set-Cookie` headers (the cookie fix from #55/#56).
- f18ac65: Add `onResponse` — an opt-in config hook to adapt Fonderie's response contract. It transforms every JSON response body at the single egress point (adapter-agnostic; status, headers, and cookies preserved), so an app can serve its own shape — e.g. flatten Fonderie's `{ reason, explanation, result: { tokens, user } }` into a frontend's expected `{ user, accessToken, refreshToken }` — without editing any handler. Unset = unchanged behaviour. Surfaced by the crewfinding rewrite (Phase 1): the response envelope was the single biggest contract divergence, and this closes it with one config option instead of a per-app adapter, moving existing-frontend adoption toward drop-in.

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
