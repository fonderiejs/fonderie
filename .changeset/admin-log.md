---
'@fonderie/admin': minor
---

The admin log — every request through the surface, refused ones included

Until now admin actions left no trace: nothing recorded who revealed a
secret, changed a template or granted credits, and a wrong token was
invisible. `AdminModule({ store })` and the package's migration add
`fonderie_admin_log`: actor (`X-Actor`, else `admin-token`), method, path,
route, module, status, duration, request id, client IP.

The log middleware runs *before* the token guard, so a refused request is
a row too; a failed write never fails the request it describes.
`GET /_admin/activity/admin-log` reads it newest first, keyset-paged. The
manifest reports `admin.log: false` when no store is given, so "not
recording" is visible.

`@fonderie/store` becomes an optional peer. Phase 5 of
`docs/ADMIN-BRICK-DESIGN.md`.
