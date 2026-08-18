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

## Scope

Fonderie, Inc. is a **self-hosted SDK** — the `@fonderie/*` packages run inside
each customer's own environment. **Fonderie, Inc. operates no multi-tenant
service and stores no end-customer data.** The audit scope is therefore
Fonderie's **corporate/development environment and software supply chain**
(GitHub, CI/CD, npm publishing, the marketing site, corporate SaaS, endpoints,
identity) — **not** a hosted data plane.

Consequence for infrastructure (Track B): customer-data infra (managed Postgres,
KMS, PITR of a customer database, service-scale log aggregation) is **out of
scope until/unless a managed offering launches**. Those remain **product
capabilities** the SDK provides to customers — implemented and evidenced in code
(see the ✅ rows) — but not operated by Fonderie, Inc. today. In-scope infra
reduces to identity/MFA, endpoint security, and access management for the systems
Fonderie actually runs.

## Summary

| Track | Items | State |
|---|---|---|
| A. Policy adoption | 13 policies | **adopted v1.0 (2026-08-18)** ✅ |
| B. Corporate/dev environment | 5 in-scope items | not yet hardened |
| C. Operating process & evidence | 6 items | not yet operating |
| D. Audit engagement | 3 items | not started |

No criterion is wholly unaddressed — every gate below has a drafted policy
and/or an implemented technical control waiting for it.

---

## A. Policy adoption (CC1, CC2, CC3, CC9) — ✅ DONE

**Adopted 2026-08-18.** All 13 policies are at **v1.0** with effective date set
and DRAFT banners removed (see [`policy-adoption-record.md`](policy-adoption-record.md)).
Next review 2027-08-18. Listed here for the control mapping.

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

## B. Corporate/dev environment (CC6)

Scoped to the systems Fonderie, Inc. **actually operates** (per Scope above):
GitHub, npm, CI/CD, the marketing site's host, Google Workspace/email, and the
founder's endpoint. No customer-data plane exists to secure.

| # | Item | Enables control | Priority |
|---|---|---|---|
| B1 | **MFA enforced** on every corporate/dev account (GitHub, npm, Google, site host) | CC6.1 authentication | **P0** |
| B2 | **Least-privilege access management** on the systems Fonderie runs; remove unused access | CC6.1/6.2/6.3 | **P0** |
| B3 | **Endpoint security** on the founder's device: full-disk encryption, screen lock, auto-update | CC6.1 | P1 |
| B4 | **Secrets handling** for CI/release (GitHub secrets + OIDC, no long-lived npm token) | CC6.1 | ✅ largely in place |
| B5 | **Backups of Fonderie's own critical data** — source is in Git; document corporate-SaaS backup/retention | A1.2 / C1 | P2 |

**Out of scope under SDK-only** (product capabilities in code, not operated by
Fonderie, Inc. — revisit only if a managed offering launches): managed Postgres
+ TLS (`assertProductionDbConfig`), KMS for a customer database, PITR of customer
data, and service-scale log aggregation of the security-event schema. These stay
✅ implemented as SDK features for customers to run in their own environment.

---

## C. Operating process & evidence (CC3, CC4, CC6, CC9, personnel)

Controls must be seen **operating over time**, not just existing.

| # | Item | Gates | Priority |
|---|---|---|---|
| C1 | ✅ **Risk assessment performed 2026-08-18** — [`risk-register.md`](risk-register.md) (19 rated risks; next review 2026-11-18) | CC3 | ✅ done |
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

1. ~~**A1–A13** adopted~~ ✅ **done 2026-08-18** (all 13 policies v1.0).
2. **B1, B2** hardened (MFA everywhere + least-privilege access on Fonderie's own systems); **B3** endpoint.
3. ~~**C1** risk assessment performed~~ ✅ done 2026-08-18.
4. **D1** auditor engaged for a point-in-time design review.

Because the scope is corporate/dev only (no customer-data plane), the infra lift
is small — it's account hygiene, not a data-center build. Type II then adds the
**D3** observation window over the adopted policies and hardened environment.
Until D1's report exists, the only truthful public claim is **"codebase readiness
assessment complete"** — never "certified" or "compliant."
