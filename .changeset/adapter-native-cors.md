---
'@fonderie/adapter-express': minor
'@fonderie/adapter-koa': minor
'@fonderie/adapter-hono': minor
---

Each adapter now exports a native `cors(options?)` middleware speaking core's CORS contract — same options and defaults as `withCors`, resolved through the same core primitives (`resolveCorsOptions`/`corsHeadersFor`), so the header contract cannot fork per framework. Register it on the framework app itself to cover every route, including ones outside the fonderie pipeline (custom routes, health checks, webhooks) — `fonderie.use(withCors())` only guards the mounted basePath.
