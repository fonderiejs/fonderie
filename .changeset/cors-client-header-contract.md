---
'@fonderie/core': minor
---

withCors now ships in lockstep with @fonderie/client's header contract. The default allow-list includes the headers the client actually sends — X-Request-ID (>=0.19), traceparent (>=0.20), X-Workspace-ID — so a client upgrade can no longer break every browser request at preflight. New options: `exposeHeaders` (defaults to exposing X-Request-ID so browser JS can read the echoed correlation id on FonderieApiError.requestId) and `credentials` (required for any cross-origin browser app, since the client always fetches with credentials:'include'); `credentials: true` with the default `origin: '*'` fails fast at boot with a clear message instead of failing per-request in the browser. Exported constants FONDERIE_CLIENT_HEADERS / DEFAULT_CORS_HEADERS / DEFAULT_CORS_EXPOSE_HEADERS let apps extend the lists without retyping them.
