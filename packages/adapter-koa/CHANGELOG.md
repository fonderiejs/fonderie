# @fonderie/adapter-koa

## 5.2.3

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 5.2.2

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 5.2.1

### Patch Changes

- 0f11dc8: The client IP now reaches fonderie's own routes. Each adapter resolved it into the context it built, but `handle()` constructed a fresh context and dropped everything the adapter had put there — so `ctx.meta.clientIp` was `undefined` in every fonderie-owned route, silently. Login events recorded no IP, per-IP rate limiting keyed on nothing, and IP-derived signals (risk, geo) had no input. `handle()` now takes an optional `IHandleInit` whose `meta` seeds the context (copied, so a request can't mutate the adapter's own), and all three adapters pass the IP they resolved. Every adapter previously tested only that its bridge SET `meta.clientIp`; each now also asserts it survives into a routed handler, which is the property that was actually broken.
- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 5.2.0

### Minor Changes

- 7a76978: Each adapter now exports a native `cors(options?)` middleware speaking core's CORS contract — same options and defaults as `withCors`, resolved through the same core primitives (`resolveCorsOptions`/`corsHeadersFor`), so the header contract cannot fork per framework. Register it on the framework app itself to cover every route, including ones outside the fonderie pipeline (custom routes, health checks, webhooks) — `fonderie.use(withCors())` only guards the mounted basePath.

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 5.1.1

### Patch Changes

- 9156a68: Adapter/parser robustness hardening (audit-3). (1) The body parser now re-materializes `ctx.request` from the ORIGINAL BYTES instead of a re-encoded string, so a handler that reads the raw body for signature verification (Stripe / SendGrid webhooks) gets byte-identical input even for payloads with a BOM or non-UTF-8 bytes. (2) adapter-koa: responses are written as a `Buffer` (via `arrayBuffer()`) instead of `text()` — `text()` UTF-8-decoded and corrupted any binary response (a `@fonderie/media` image, an invoice PDF, gzip). (3) adapter-koa: `koaContextToWeb` no longer hangs when an upstream middleware already drained the request stream without setting `rawBody` (guards on `readableEnded`/`destroyed`). (4) adapter-express and adapter-koa: the streamed-overflow backstop no longer destroys the socket before the `413` is written, so an oversize chunked upload gets a clean `413` instead of a connection reset (matching core's `listen()`).

## 5.1.0

### Minor Changes

- 6724b28: Two hardening fixes from the audit-2 residual backlog. (1) adapter-koa no longer silently drops request bodies when koa-bodyparser isn't installed: `koaContextToWeb` is now async and reads the socket stream itself (capped at `DEFAULT_MAX_BODY_BYTES`, configurable via `bridge`/`mount` `{ maxBodyBytes }`) when `rawBody` is absent, returning `413` for an oversize declared body. The adapter no longer hard-depends on koa-bodyparser. (2) core: `defaultErrorHandler` only leaks the raw error message when `NODE_ENV` is explicitly `development` or `test` — previously any non-`production` value (including `staging`) leaked messages that can carry connection strings/PII; unknown/unset envs are now treated as production-safe. (3) core router: a malformed percent-encoding or a decoded NUL byte in a path parameter now yields a clean 404 (no match) instead of a 500, and blocks a NUL-injection primitive for downstream consumers.

## 5.0.10

### Patch Changes

- 6352106: Fix a request stall on multi-MiB bodies in every adapter bridge, and stop swallowing parser short-circuits. All three bridges `clone()`d the request before `buildContext()` — undici's tee applies backpressure from the slower branch, so fully reading one branch while the other sat unread stalled any body past the stream's high-water mark (a legal 4 MiB upload hung forever; surfaced by the new in-parser body cap's tests). The bridges now let `buildContext` consume the body — core's parser re-materializes `ctx.request` from the buffered bytes — and `mount()`/infra fallbacks reuse that request. `buildContext` also surfaces a global-middleware short-circuit on `ctx.meta['pipelineResponse']` (previously discarded), so the parser's `413 PAYLOAD_TOO_LARGE` now actually reaches the client through every adapter. The adapters require core ≥0.10.1 for this contract.

## 5.0.9

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 5.0.8

### Patch Changes

- Updated dependencies [cd2706a]
- Updated dependencies [cd2706a]
- Updated dependencies [cd2706a]
  - @fonderie/billing@9.0.0
  - @fonderie/workspaces@6.0.0

## 5.0.7

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.0.6

### Patch Changes

- Updated dependencies [04f74b2]
  - @fonderie/billing@8.0.0

## 5.0.5

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.0.4

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.0.3

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.0.2

### Patch Changes

- Updated dependencies [49eeef0]
  - @fonderie/billing@7.0.0

## 5.0.1

### Patch Changes

- Updated dependencies [ee4a5fb]
- Updated dependencies [7f8778f]
- Updated dependencies [720c47f]
  - @fonderie/billing@6.0.0

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/billing@5.0.0
  - @fonderie/permissions@5.0.0
  - @fonderie/workspaces@5.0.0

## 4.0.0

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [9eb3c80]
- Updated dependencies [5130aba]
  - @fonderie/core@0.4.0
  - @fonderie/workspaces@4.0.0
  - @fonderie/billing@4.0.0
  - @fonderie/permissions@4.0.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/billing@3.0.0
  - @fonderie/permissions@3.0.0
  - @fonderie/workspaces@3.0.0

## 2.0.0

### Patch Changes

- e4d9bb2: Complete the auth-cookie fix across every response egress. The same `Set-Cookie` mangling fixed in `@fonderie/adapter-express` also existed in `@fonderie/adapter-koa` and in `@fonderie/core`'s built-in `app.listen()` HTTP server: forwarding headers with `forEach` + `set()`/`setHeader()` overwrites all but the last `Set-Cookie`, so cookie-based auth silently broke there too. Both now forward the full list via `getSetCookie()`. `@fonderie/adapter-hono` was already correct (it returns the Web `Response` natively). Found by auditing sibling packages after the express fix.
- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
- Updated dependencies [c0f05ea]
  - @fonderie/core@0.2.0
  - @fonderie/workspaces@2.0.0
  - @fonderie/billing@2.0.0
  - @fonderie/permissions@2.0.0

## 1.0.3

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.0.2

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
  - @fonderie/billing@1.0.1
  - @fonderie/permissions@1.0.1
  - @fonderie/workspaces@1.0.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/billing@1.0.0
  - @fonderie/core@0.1.0
  - @fonderie/permissions@1.0.0
  - @fonderie/workspaces@1.0.0
