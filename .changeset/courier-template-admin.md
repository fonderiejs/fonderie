---
"@fonderie/courier": minor
"@fonderie/cli": minor
---

Courier template admin surface — bring versioned template management to config
parity. `CourierModule` registers `/admin/templates/*` routes **only when an
`adminToken` is configured** (fail-closed; requires `@fonderie/store` for db
templates), each guarded by a `Bearer` token. Endpoints mirror config: list /
get / put (with `ifVersion` optimistic concurrency → **409**) / delete /
`GET :type/revisions` / `POST :type/rollback`. Templates are keyed by
`(type, locale)` — the `?locale` query scopes a request, a null locale is the
base — and writes record an actor (optional `X-Actor` header). Exports
`buildTemplateAdminRoutes` and `deleteTemplate`.

The CLI gains a `template` verb group — `fonderie template get|set|delete|history|rollback`
against a live deployment's admin API (`FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`),
scoped with `--locale` and carrying `--subject` / `--html` on `set`.
