---
'@fonderie/courier': minor
---

Describe the admin routes for `@fonderie/admin`; legacy `/admin/*` paths deprecated

`describeAdmin()` offers the same handlers as the standalone `/admin/*`
surface — unguarded and prefix-relative — for `@fonderie/admin` to mount
under its prefix behind its own token. One route table backs both, so they
cannot drift.

The standalone `/admin/*` routes, guarded by this module's `adminToken`,
keep working unchanged and are **deprecated**: they go in a later major, once
the composed surface is the norm. `docs/ADMIN-BRICK-DESIGN.md` phase 3.
