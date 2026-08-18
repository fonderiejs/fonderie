---
"@fonderie/client": minor
---

feat(client): opt-in response cache + reactive token renewal

Two optional capabilities so apps stop hand-rolling a data layer around the
client. Both are off by default — existing behaviour is unchanged.

- **Cache** — pass `cache: createMemoryCache()`. GETs are cached (with in-flight
  dedup) and writes auto-invalidate the resource they touch
  (`customers.create()` evicts the customers reads). Per-call control via
  `client.get(path, { cache, bust })` / `post(path, body, { invalidate })`. The
  cache is created **per client instance** (SSR-safe — no module globals, no
  background timer; it sweeps lazily). `clearCache()` and sign-out clear it.
- **Reactive renew** — pass `auth: { getRefreshToken, onTokensChanged, onAuthError }`.
  On a 401 (never for `/auth/*`), the client refreshes once (single-flight) and
  retries with the new token, so both typed modules and the generic transport
  renew automatically.
