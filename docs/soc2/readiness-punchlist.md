# SOC 2 readiness punch-list — what still gates the claim

> The **codebase** controls are implemented and verified in CI (see
> [`control-matrix.md`](control-matrix.md) ✅ rows and [`readiness-plan.md`](readiness-plan.md)).
> This list is the **non-code** work that must be done before Fonderie can
> truthfully claim a SOC 2 Type I (point-in-time) or Type II (over a window)
> report. Nothing here can be closed from the repo alone.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Last updated:
> **2026-08-18**. Legend: **P0** blocks any audit · **P1** auditor expects ·
> **P2** hardening.

## Summary

| Track | Items | State |
|---|---|---|
| A. Policy adoption | 13 policies | drafted, **unadopted** |
| B. Production infrastructure | 7 items | not provisioned |
| C. Operating process & evidence | 6 items | not yet operating |
| D. Audit engagement | 3 items | not started |

No criterion is wholly unaddressed — every gate below has a drafted policy
and/or an implemented technical control waiting for it.

---

## A. Policy adoption (CC1, CC2, CC3, CC9)

Each policy exists as **DRAFT v0.1** with `Effective: [date on adoption]` and
`[bracketed]` values to confirm. **Adopt** = resolve brackets → officer approves
→ set effective date → bump to **v1.0**. Same action for all 13.

| # | Policy file | Gates | Priority |
|---|---|---|---|
| A1 | `docs/policies/information-security.md` (master) | CC1.2 | **P0** |
| A2 | `docs/policies/acceptable-use.md` | CC1.1 | P1 |
| A3 | `docs/policies/access-control.md` | CC6.2/6.3 | **P0** |
| A4 | `docs/policies/change-management.md` | CC8.1 | P1 |
| A5 | `docs/policies/cryptography.md` | CC6.1 | P1 |
| A6 | `docs/policies/data-classification.md` | C1.1 | P1 |
| A7 | `docs/policies/data-retention.md` | C1.2 | P1 |
| A8 | `docs/policies/business-continuity.md` | A1.2 | P1 |
| A9 | `docs/policies/incident-response.md` | CC7.3–7.5 | **P0** |
| A10 | `docs/policies/logging-monitoring.md` | CC7.2 | P1 |
| A11 | `docs/policies/personnel-security.md` | CC1.4 | P1 |
| A12 | `docs/policies/risk-management.md` | CC3.1–3.4 | **P0** |
| A13 | `docs/policies/vendor-management.md` | CC9.2 | P1 |

---

## B. Production infrastructure (CC6, CC7, A1)

The technical controls enforce these **once infra exists** — e.g. `assertProductionDbConfig`
already fails closed on plaintext DB transport, but needs a TLS-terminated
database to protect. "Config flip, not a rebuild."

| # | Item | Enables control | Priority |
|---|---|---|---|
| B1 | Managed Postgres with **TLS termination** | CC6.7 (A4 DB-TLS gate operates) | **P0** |
| B2 | **PITR backups** + tested restore, documented RTO/RPO | A1.2 backups & recovery | **P0** |
| B3 | **KMS** for at-rest encryption of DB + backups | CC6.1 encryption at rest (beyond in-product MFA AES-GCM) | **P0** |
| B4 | **Secrets manager** for prod credentials (no secrets in env files) | CC6.1 secrets handling | P1 |
| B5 | **Log aggregation + alerting** wired to the security-event schema and integrity-check failures | CC7.2 monitoring | P1 |
| B6 | **Backup retention** window configured at the infra layer | C1 disposal | P1 |
| B7 | Prod **access management** (SSO/MFA on the cloud console, least-privilege IAM) | CC6.1/6.2 | **P0** |

---

## C. Operating process & evidence (CC3, CC4, CC6, CC9, personnel)

Controls must be seen **operating over time**, not just existing.

| # | Item | Gates | Priority |
|---|---|---|---|
| C1 | Perform a real **risk assessment**; populate `risk-register.md` with rated, owned risks | CC3 | **P0** |
| C2 | Run the **quarterly access review** and record it in `access-review-register.md` | CC6.2/6.3 | P1 |
| C3 | Finalize **vendor/subprocessor inventory** (`vendor-inventory.md`) + review each vendor's SOC 2 | CC9.2 | P1 |
| C4 | **Personnel controls**: onboarding/offboarding checklist, background checks, annual security training | CC1.4 | P1 |
| C5 | Dry-run the **incident-response runbook** (tabletop) and log it | CC7.3–7.5 | P2 |
| C6 | Confirm **control-monitoring cadence** — schedule the integrity-check job + review its alerts in prod | CC4.1/CC7.2 | P1 |

---

## D. Audit engagement (the report itself)

| # | Item | Priority |
|---|---|---|
| D1 | Engage a **licensed CPA firm** for SOC 2 (scope Type I first, then Type II) | **P0** |
| D2 | Stand up an **evidence platform** (Vanta / Drata / Secureframe) and connect GitHub + cloud | P1 |
| D3 | Run the **observation window** — Type I is point-in-time; Type II needs the controls operating ~3–12 months | **P0** |

---

## Critical path to a Type I

1. **A1, A3, A9, A12** adopted (master + access + incident-response + risk-management policies).
2. **B1, B2, B3, B7** provisioned (TLS Postgres, backups, KMS, prod access management).
3. **C1** risk assessment performed.
4. **D1** auditor engaged for a point-in-time design review.

Type II then adds the **D3** observation window over the adopted policies and
provisioned infra. Until D1's report exists, the only truthful public claim is
**"codebase readiness assessment complete"** — never "certified" or "compliant."
