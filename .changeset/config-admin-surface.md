---
"@fonderie/config": minor
---

Config control-plane, phase 4 — the safe admin HTTP surface. `ConfigModule`
registers `/admin/config/*` and `/admin/secrets/*` routes **only when an
`adminToken` is configured** (fail-closed — no token, no exposed admin surface),
each guarded by a `Bearer` token. Endpoints: list / get / put (with `ifVersion`
optimistic concurrency → **409** on a lost compare-and-swap) / delete /
`GET :key/revisions` / `POST :key/rollback`, for both config and secrets. Secret
reads stay masked; `POST /admin/secrets/:key/reveal` is the single decrypt path.
Writes record an actor (optional `X-Actor` header). A `secretEncryptor` option
wires at-rest encryption. Exports `buildAdminRoutes`.
