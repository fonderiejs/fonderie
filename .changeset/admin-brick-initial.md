---
'@fonderie/admin': minor
---

New brick: `@fonderie/admin` — the operator's surface

The model that assembled the app knows what is installed, wired and
configured. The human who deployed it does not, unless they are back in a
development session and can ask. The answer already existed in core
(`securityReport()`, `app.routes()`); it had no address.

`AdminModule({ adminToken, path = '/_admin' })` owns one reserved prefix —
no other module can mount under it, a collision fails boot — behind one
admin token, fail-closed by absence and strength-checked at boot like every
other brick's admin surface.

`GET /_admin/manifest`: every registered module with its version (when it
reports one) and its readiness problems, the aggregate readiness, and the
full route table with the module that mounted each route. Readiness details
are shown here in production, unlike the public `/readyz`, because the
operator is the audience.

Phase 2 of `docs/ADMIN-BRICK-DESIGN.md`. Bricks describing their own admin
routes and checks (composition, doctor) come next.
