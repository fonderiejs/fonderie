---
"@fonderie/adapter-koa": minor
"@fonderie/core": patch
---

Two hardening fixes from the audit-2 residual backlog. (1) adapter-koa no longer silently drops request bodies when koa-bodyparser isn't installed: `koaContextToWeb` is now async and reads the socket stream itself (capped at `DEFAULT_MAX_BODY_BYTES`, configurable via `bridge`/`mount` `{ maxBodyBytes }`) when `rawBody` is absent, returning `413` for an oversize declared body. The adapter no longer hard-depends on koa-bodyparser. (2) core: `defaultErrorHandler` only leaks the raw error message when `NODE_ENV` is explicitly `development` or `test` — previously any non-`production` value (including `staging`) leaked messages that can carry connection strings/PII; unknown/unset envs are now treated as production-safe. (3) core router: a malformed percent-encoding or a decoded NUL byte in a path parameter now yields a clean 404 (no match) instead of a 500, and blocks a NUL-injection primitive for downstream consumers.
