# @fonderie/auth

## 3.0.0

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

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/events@3.0.0
  - @fonderie/rate-limit@2.0.0

## 2.1.0

### Minor Changes

- 41c29b0: Add `routes` to `IAuthConfig` — override the HTTP path (and optionally method) of any auth route, keyed by a stable id (`register`, `forgotPassword`, `me`, `updateProfile`, …). Lets an app match an existing frontend's contract **without a gateway or path shim** — e.g. `routes: { forgotPassword: '/auth/forgot-password', updateProfile: { method: 'PATCH', path: '/users/me' } }`. A bare string overrides the path; an object can also change the method; unset routes keep their defaults. Surfaced by the crewfinding rewrite: this eliminates the app-side path shim the Phase-1 re-run needed, taking adoption-under-an-existing-frontend to fully drop-in for the auth surface.

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
