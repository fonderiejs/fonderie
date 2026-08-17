# Data Retention & Disposal Policy

> **Status:** DRAFT stub — not adopted. Fill every `[FILL: …]` and have an
> officer approve before it counts as a control.
> Owner: `[FILL: role]` · Version: 0.1 · Effective: `[FILL: date]` ·
> Review: annually or on material change.

## Policy
- Retention periods by data type: `[FILL: e.g. audit logs 1y, deleted accounts 30d]`.
- **Disposal.** Aged records purged on schedule via `purgeEvents` and
  `purgeSoftDeletedUsers`; backups age out per the BC/DR policy.
- **Right to erasure.** Deletion requests honored within `[FILL: e.g. 30d]`;
  user data export available via the SAR endpoint (`GET /users/export`).
- Disposal is logged.
