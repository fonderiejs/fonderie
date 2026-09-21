---
'@fonderie/billing': minor
---

Describe the admin routes for `@fonderie/admin`; inline `/plans` writes and `/billing/wallet/grant` deprecated

`describeAdmin()` offers the plan writes (`POST /plans`, `PUT|DELETE
/plans/:planId`) and, with `config.wallet`, `POST /wallet/grant` — unguarded
and prefix-relative — for `@fonderie/admin` to mount under its prefix behind
its own token. They keep their `validate()` chains.

The standalone routes at `/plans` and `/billing/wallet/grant`, guarded by
this module's `adminToken`, keep working unchanged and are **deprecated**:
they go in a later major. `docs/ADMIN-BRICK-DESIGN.md` phase 3.
