---
'@fonderie/billing': minor
---

Describe the money reads for `@fonderie/admin`

`describeAdmin()` now also offers, under the admin prefix: `GET /catalog`
— plans as configured *and* as stored, both shown so a divergence is
visible; `GET /subscriptions/:type/:id`; and with `config.wallet`,
`GET /wallet/:type/:id` (balance, `?currency=`) and
`GET /wallet/:type/:id/ledger` (paged like the user's own). All through the
existing user-facing DTOs, so the operator sees exactly what the customer
would. The plan writes and `/wallet/grant` were described in phase 3.
Phase 8c of `docs/ADMIN-BRICK-DESIGN.md`.
