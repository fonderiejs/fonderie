---
'@fonderie/core': patch
'@fonderie/adapter-hono': patch
'@fonderie/adapter-express': patch
'@fonderie/adapter-koa': patch
'@fonderie/billing': patch
---

**A request counts once against a plan's rate limit, not twice.** For a request that falls through to a fonderie-owned route (`/auth/*`, `/billing/*`, `/workspaces/*`, …), an adapter runs the global middleware in `bridge()` and again inside `handle()`. Billing's windowed counters (`'api-calls': { limit, window: '1d' }`) were incremented on both passes, so a plan selling 1,000 calls a day blocked at about 500 on those routes. App-owned routes counted once.

Adapters now hand `handle()` the first pass's meta as `ctx.meta.bridged` (documented on `IFonderieContextMeta`), and billing reuses its context from there when it is for the same subscriber: no second increment, no second grant or notice. Any global middleware with a per-request side effect can do the same. `withMetrics` and a user-added `.use()` rate limiter still count twice (stricter, never a bypass).

**Limit notices for user subscribers are delivered.** A `limit-warning` / `limit-reached` notice for a user subscriber was left on `ctx.meta.messages`, which nothing sends. With `config.resolveRecipient` and an event bus wired, every subscriber's notice now goes out on the bus, as workspace notices already did. Without them, notices stay on `ctx.meta.messages` for the app to send.
