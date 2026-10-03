---
'@fonderie/billing': patch
'@fonderie/adapter-hono': patch
'@fonderie/adapter-express': patch
'@fonderie/adapter-koa': patch
---

**Billing webhooks refuse unverifiable deliveries on every host.** Node-server hosts (local, Docker, Cloud Run) replace `globalThis.Response` after `@fonderie/core` has loaded, so the webhook routes' `instanceof Response` check missed core's own refusal. A delivery with no webhook secret configured, no signature, or an invalid signature was then treated as a verified event and answered `200 {"received":true}` instead of 500/400. The signature check now returns a tagged result that no host can confuse; the same request served in-process was never affected.

The adapters had the same hazard for pipeline short-circuits (a parser 413, a guard's refusal): they now recognise a Response by its shape, not its global identity, so the refusal is sent instead of the request carrying on.
