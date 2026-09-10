---
"@fonderie/core": patch
"@fonderie/adapter-hono": patch
"@fonderie/adapter-express": patch
"@fonderie/adapter-koa": patch
---

Fix a request stall on multi-MiB bodies in every adapter bridge, and stop swallowing parser short-circuits. All three bridges `clone()`d the request before `buildContext()` — undici's tee applies backpressure from the slower branch, so fully reading one branch while the other sat unread stalled any body past the stream's high-water mark (a legal 4 MiB upload hung forever; surfaced by the new in-parser body cap's tests). The bridges now let `buildContext` consume the body — core's parser re-materializes `ctx.request` from the buffered bytes — and `mount()`/infra fallbacks reuse that request. `buildContext` also surfaces a global-middleware short-circuit on `ctx.meta['pipelineResponse']` (previously discarded), so the parser's `413 PAYLOAD_TOO_LARGE` now actually reaches the client through every adapter. The adapters require core ≥0.10.1 for this contract.
