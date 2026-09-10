---
"@fonderie/adapter-hono": patch
---

Fix a regression: `bridge()` consumes the request body to build the fonderie context (no clone, to avoid a tee-stall on large bodies), which drained `c.req.raw` — so an app's OWN native hono handlers calling `c.req.json()` / `c.req.text()` / `c.req.parseBody()` got an empty/used body. The bridge now repoints `c.req.raw` at the re-materialized (buffered) request after building the context, so native handlers read the body normally; for content-types the parser leaves untouched (multipart) it's a no-op.
