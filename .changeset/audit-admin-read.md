---
'@fonderie/audit': minor
---

Describe the cross-workspace read for `@fonderie/admin`

`describeAdmin()` offers `GET /audit` under the admin prefix: the same
filters (`type`, `actorId`, `from`, `to`, `limit`, `cursor`) and DTO as the
workspace-scoped route, with `workspaceId` optional — every workspace unless
one is named. `AuditEventModel.listAcross()` backs it. No standalone
surface. Phase 8d of `docs/ADMIN-BRICK-DESIGN.md`.
