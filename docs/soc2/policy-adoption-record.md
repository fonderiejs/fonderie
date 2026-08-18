# Policy adoption record

> **Evidence artifact.** The 13 security policies in [`../policies/`](../policies/)
> are fully drafted at **v0.1**. Adoption is a single act: the approver reviews
> the set, then records the **effective date** and their **approval** here and in
> each policy header (`Version: 1.0`, `Effective: <date>`, remove the DRAFT
> banner). This sheet is what an auditor collects as proof the policies are
> formally adopted and owned.
>
> **Nothing is adopted until the approver fills the date below.** Do not backdate.

## Approval

| Field | Value |
|---|---|
| Organization | Fonderie, Inc. |
| Approver (officer) | Louis Choleski (founder, acting Security Officer) |
| Adoption date (effective) | **☐ _pending approver signature_** |
| Next review | Adoption date + 12 months (or on material change) |

## Policies adopted under this record

Set each to `Version: 1.0` · `Effective: <adoption date>` and delete its DRAFT
banner when signing.

| # | Policy | Owner | Adopted |
|---|---|---|---|
| 1 | [Information Security (master)](../policies/information-security.md) | Security Officer | ☐ |
| 2 | [Acceptable Use](../policies/acceptable-use.md) | Security Officer | ☐ |
| 3 | [Access Control](../policies/access-control.md) | Security Officer | ☐ |
| 4 | [Change Management & Secure SDLC](../policies/change-management.md) | Security Officer | ☐ |
| 5 | [Cryptography](../policies/cryptography.md) | Security Officer | ☐ |
| 6 | [Data Classification & Handling](../policies/data-classification.md) | Security Officer | ☐ |
| 7 | [Data Retention & Disposal](../policies/data-retention.md) | Security Officer | ☐ |
| 8 | [Business Continuity & DR](../policies/business-continuity.md) | Security Officer | ☐ |
| 9 | [Incident Response](../policies/incident-response.md) | Security Officer | ☐ |
| 10 | [Logging & Monitoring](../policies/logging-monitoring.md) | Security Officer | ☐ |
| 11 | [HR / Personnel Security](../policies/personnel-security.md) | Security Officer | ☐ |
| 12 | [Risk Assessment & Management](../policies/risk-management.md) | Security Officer | ☐ |
| 13 | [Vendor / Subprocessor Management](../policies/vendor-management.md) | Security Officer | ☐ |

## How to sign (one pass)

1. Read each policy; confirm every statement is true for how Fonderie actually
   operates today. If a statement describes something not yet done (e.g. a
   control that depends on unprovisioned infra), either qualify it or hold that
   policy back — **do not adopt a policy that overstates reality.**
2. Fill the **Adoption date** above.
3. In each policy header: set `Version: 1.0`, `Effective: <date>`, remove the
   `> Status: DRAFT` banner.
4. Commit as `docs(soc2): adopt security policies v1.0 (effective <date>)`.

See the full gating list in [`readiness-punchlist.md`](readiness-punchlist.md)
(track A) and control mappings in [`control-matrix.md`](control-matrix.md).
