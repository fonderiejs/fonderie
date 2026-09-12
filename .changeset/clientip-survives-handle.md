---
'@fonderie/core': minor
'@fonderie/adapter-express': patch
'@fonderie/adapter-hono': patch
'@fonderie/adapter-koa': patch
---

The client IP now reaches fonderie's own routes. Each adapter resolved it into the context it built, but `handle()` constructed a fresh context and dropped everything the adapter had put there — so `ctx.meta.clientIp` was `undefined` in every fonderie-owned route, silently. Login events recorded no IP, per-IP rate limiting keyed on nothing, and IP-derived signals (risk, geo) had no input. `handle()` now takes an optional `IHandleInit` whose `meta` seeds the context (copied, so a request can't mutate the adapter's own), and all three adapters pass the IP they resolved. Every adapter previously tested only that its bridge SET `meta.clientIp`; each now also asserts it survives into a routed handler, which is the property that was actually broken.
