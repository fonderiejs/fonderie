---
"@fonderie/adapter-hono": major
---

Stop trusting client-settable IP headers by default (BREAKING for deployments that relied on it). `bridge()` treated `cf-connecting-ip` / `x-real-ip` request headers as the platform-verified address unconditionally — any direct client could forge its IP (defeating per-IP auth rate limiters with a fresh bucket per request) or omit it (skipping the limiter entirely). The bridge now resolves the client IP spoof-safe: the real socket address when the runtime exposes one (`@hono/node-server`), an explicitly configured platform header via the new `bridge(fonderie, { ipHeader: 'cf-connecting-ip' })` option, or X-Forwarded-For per core's `TRUST_PROXY` hop count. Cloudflare/edge deployments must now pass `ipHeader` explicitly — only do so when the platform strips that header from client requests.
