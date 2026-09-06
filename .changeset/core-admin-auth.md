---
'@fonderie/core': minor
'@fonderie/billing': minor
'@fonderie/courier': minor
'@fonderie/config': patch
---

Unify admin-route authentication into one shared primitive (see docs/ADMIN-AUTH-SPEC.md).

Every module with an ops/admin surface (billing plan-writes + wallet-grant, config/secrets admin, courier template admin) previously shipped its own hand-rolled Bearer guard — three byte-identical copies of `safeTokenEqual` + the guard, with no guarantee they stayed in sync.

- **`@fonderie/core`** now exports `requireAdminToken(adminToken)` and `validateAdminToken(token, { module })` from `@fonderie/core/middlewares` — the one constant-time Bearer guard and the one admin-token strength rule (min 32 chars, reject placeholders). Core depends on nothing, so there is no cycle.
- **`@fonderie/billing`** and **`@fonderie/courier`** delete their local guard copies and adopt the shared one, and — the real fix — now call `validateAdminToken` in `checkReadiness()`, so a weak/placeholder admin token guarding `/plans` + `/billing/wallet/grant` or `/admin/templates` is a **production readiness error** (previously only `@fonderie/config` enforced this; billing/courier accepted a `changeme` token).
- **`@fonderie/config`** drops its duplicate guard + strength logic for the shared core versions — behavior-identical, no observable change.

No route paths, methods, request/response shapes, or config fields change. `requireAdminToken` behavior (Bearer, constant-time, `401 UNAUTHORIZED / "Missing or invalid admin token"`) is preserved exactly.
