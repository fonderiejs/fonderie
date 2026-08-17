# Security policies — starter kit

SOC 2 tests whether documented policies exist **and** are followed. These are
**draft stubs** to adapt, not finished policies: fill every `[FILL: …]`, delete
what doesn't apply, and have an accountable officer approve and date each one.
Where a control is already implemented in code, the stub links to it so the
policy and the evidence line up.

| Policy | Covers (SOC 2) |
|---|---|
| [Information Security](information-security.md) | CC1–CC5 — the master policy |
| [Access Control](access-control.md) | CC6.1–CC6.3 |
| [Cryptography](cryptography.md) | CC6.1 / C1 |
| [Change Management & Secure SDLC](change-management.md) | CC8.1 |
| [Incident Response](incident-response.md) | CC7.3–CC7.5 |
| [Logging & Monitoring](logging-monitoring.md) | CC7.1–CC7.2 |
| [Business Continuity & DR](business-continuity.md) | A1.2–A1.3 |
| [Data Retention & Disposal](data-retention.md) | C1 / P4 |
| [Data Classification & Handling](data-classification.md) | C1 / Privacy |
| [Vendor / Subprocessor Management](vendor-management.md) | CC9.2 |
| [Risk Assessment & Management](risk-management.md) | CC3.1–CC3.4 |
| [Acceptable Use](acceptable-use.md) | CC1.1 |
| [HR / Personnel Security](personnel-security.md) | CC1.4 |

See also [`../OPERATIONS.md`](../OPERATIONS.md) (backups, monitoring, branch
protection) and [`../../SOC2-readiness.md`](../../SOC2-readiness.md) (control
gap tracker).
