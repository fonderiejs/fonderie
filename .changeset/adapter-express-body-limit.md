---
'@fonderie/adapter-express': minor
---

Cap the request body the Express adapter buffers (default **5 MiB**).
Previously `readStream` read an arbitrarily large body fully into memory before
any handler — or even auth — ran, a memory-exhaustion DoS. Now a
declared-oversize body is rejected via `Content-Length` before a byte is read,
and a chunked/unbounded body is cut off mid-stream once it crosses the cap;
over-limit requests get a **413**. Configurable per app:
`mount(app, fonderie, register, { maxBodyBytes })` (also on `bridge`).

This is the complementary half of the `@fonderie/media` upload DoS fix — media
guards its decode, this bounds the raw body read for **every** route.

**Behavior change:** requests with bodies over 5 MiB are now rejected by
default. If you accept larger uploads (e.g. big `@fonderie/media` images), raise
`maxBodyBytes`. (`adapter-koa` relies on `koa-bodyparser`'s limit and
`adapter-hono` on Hono's `bodyLimit` — those are unchanged.)
