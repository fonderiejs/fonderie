---
'@fonderie/billing': major
---

Security hardening (from the 2026-09-05 audit). The money core was found sound; these close pre-existing peripheral gaps in the base module.

**BREAKING — DB-plan write API is now admin-token-gated.** `POST/PUT/DELETE /plans` were registered unauthenticated (any caller could edit/delete the persisted plan catalog — defacement/availability; no charge impact, since runtime billing reads `config.plans` in memory, not this table). They are now registered **only when the new `config.planAdminToken` is set**, each guarded by `requireAdminToken` (constant-time), exactly like `POST /billing/wallet/grant`. `GET /plans` and `GET /plans/:planId` stay public.

*Migration:* if you manage plans via these routes, set `config.planAdminToken` and send it as the admin bearer token; otherwise the write routes return 404 (they are not registered). Consumers that define plans via `config.plans` (the common case) are unaffected.

Also hardened (non-breaking):
- **Ledger cursor** — the pagination cursor's timestamp is now range-checked, so a crafted in-shape-but-out-of-range value returns `422` instead of a Postgres cast `500`.
- **Plan id** — a non-UUID `:planId` on `GET/PUT/DELETE /plans/:planId` returns `404` (get) / no-op (update/delete) instead of a `22P02` `500`; `getDBPlans` is capped at 500 rows.
- **Rate-limit notices** — the module-level dedup Set now clears a counter's markers when it returns below its threshold (bounded memory; a later re-crossing notifies again), mirroring the existing low-balance hysteresis.

Adversarially reviewed; verified against real PostgreSQL.
