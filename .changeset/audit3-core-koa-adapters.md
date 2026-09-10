---
"@fonderie/core": patch
"@fonderie/adapter-koa": patch
"@fonderie/adapter-express": patch
---

Adapter/parser robustness hardening (audit-3). (1) The body parser now re-materializes `ctx.request` from the ORIGINAL BYTES instead of a re-encoded string, so a handler that reads the raw body for signature verification (Stripe / SendGrid webhooks) gets byte-identical input even for payloads with a BOM or non-UTF-8 bytes. (2) adapter-koa: responses are written as a `Buffer` (via `arrayBuffer()`) instead of `text()` — `text()` UTF-8-decoded and corrupted any binary response (a `@fonderie/media` image, an invoice PDF, gzip). (3) adapter-koa: `koaContextToWeb` no longer hangs when an upstream middleware already drained the request stream without setting `rawBody` (guards on `readableEnded`/`destroyed`). (4) adapter-express and adapter-koa: the streamed-overflow backstop no longer destroys the socket before the `413` is written, so an oversize chunked upload gets a clean `413` instead of a connection reset (matching core's `listen()`).
