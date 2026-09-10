---
"@fonderie/core": minor
---

Cap the request body in the built-in `listen()` server (DoS guard). The Node server previously buffered the entire request body into memory with no limit, so a single unauthenticated request could exhaust memory before any handler ran. Bodies are now capped at 5 MiB by default (`DEFAULT_MAX_BODY_BYTES`, exported) — the same default the adapters use — with a Content-Length fast path that rejects declared-oversize bodies before reading a byte and a streaming backstop for chunked/lying lengths. Oversize requests get `413 PAYLOAD_TOO_LARGE`. Configure via the new `maxBodyBytes` config option (adapter deployments keep configuring the cap on the adapter instead).
