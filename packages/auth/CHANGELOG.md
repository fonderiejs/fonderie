# @fonderie/auth

## 2.0.0

### Patch Changes

- 5c9d49b: Fix auth cookies not reaching the client. Two bugs made `access_token` / `refresh_token` cookies unusable end-to-end: (1) `@fonderie/auth` emitted both cookies joined into a single comma-separated `Set-Cookie` header (invalid HTTP — each cookie needs its own header, and the two have different Paths); (2) `@fonderie/adapter-express` forwarded response headers with `forEach` + `setHeader`, which overwrites repeated `Set-Cookie` headers so only the last survived. Auth now returns one string per cookie and sets them via a `Headers` object (`cookieHeaders`); the express adapter forwards the full list via `getSetCookie()`. Cookie names, attributes (HttpOnly, SameSite=Strict, per-cookie Path, Secure) are unchanged — they now actually arrive. Surfaced by the crewfinding rewrite (Phase 1), where the frontend's expected auth cookies were missing.
- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0
  - @fonderie/rate-limit@1.0.0

## 1.3.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.
- Updated dependencies [9cbb2eb]
  - @fonderie/rate-limit@0.1.1

## 1.3.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.3.0

### Minor Changes

- a121955: Security: access tokens are now revocable. Each token pair carries a `sid`
  claim bound to its server-side session row (`fonderie_sessions.sid`, new
  migration), and `withSession` rejects access tokens whose session has been
  deleted — so logout, refresh rotation, and password change kill the access
  token immediately instead of letting it live out its JWT expiry. New
  `accessTokenDuration` config (default '24h') controls the access-token
  lifetime. Legacy tokens without a `sid` (issued before this release, and
  short-lived mfaPending tokens) still authenticate and age out naturally.

## 1.2.0

### Minor Changes

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

## 1.1.1

### Patch Changes

- Two security fixes found by measuring an AI agent's build against this module:

  - Auth cookies now carry the `Secure` attribute (default: `NODE_ENV ===
'production'`; override with the new `secureCookies` config flag). All
    login paths — email, phone, OAuth, MFA, refresh, logout — share one
    cookie serializer, so the attributes can't drift between routes again.
  - The forgot-password cooldown no longer answers `429 VERIFICATION_COOLDOWN`
    (which fired only for existing accounts, letting an attacker enumerate
    users by requesting twice). Within the cooldown the send is silently
    skipped and the response is byte-identical to the unknown-email branch.

## 1.1.0

### Minor Changes

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

## 1.0.1

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

- Updated dependencies
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
