---
'@fonderie/core': minor
'@fonderie/adapter-hono': minor
'@fonderie/client': minor
---

The endpoint now decides how long clients may cache it, and the client obeys.

**Why:** `@fonderie/client` cached every GET for its default lifetime and ignored the response's `Cache-Control`. `/config/public` already answered `no-store`, and it was cached anyway, one of the causes of a phone showing a stale screen switch. The endpoint knows how volatile its data is, so the client shouldn't guess.

- **`withCache({ maxAge, scope? })` / `withCache(false)`**: in `@fonderie/core/middlewares`, plus a native Hono version in `@fonderie/adapter-hono`, sharing one header builder. It sets a standard `Cache-Control`: `private, max-age=N` by default, `public` for CDN-shareable data, `no-store` for `false`. A header the handler set itself is kept.
- **The client honours `Cache-Control`**: `no-store`/`no-cache` → not cached; `max-age=N` → N seconds; otherwise the default TTL. An explicit per-call `cache` or `bust` still wins.
