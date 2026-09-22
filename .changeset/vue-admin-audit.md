---
'@fonderie/vue-admin': minor
'@fonderie/vue-admin-screens': minor
---

Audit: the hook and the page

`useAdminAudit` over `AuditAdminClient` (paged, `loadMore`), and
`AuditScreen` under Activity in the shell, shown when `auditClient` is
given: every workspace unless one is named, filterable by type and actor.
The chain's integrity verdict lives on the Doctor page (`events.integrity`).
Phase 8d-ui of `docs/ADMIN-BRICK-DESIGN.md`.
