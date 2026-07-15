---
"@fonderie/rate-limit": minor
"@fonderie/auth": minor
"@fonderie/core": patch
"@fonderie/adapter-express": patch
"@fonderie/adapter-hono": patch
"@fonderie/adapter-koa": patch
---

New package **@fonderie/rate-limit** and default brute-force protection in auth.

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
