# Vanta onboarding checklist

> Maps Vanta's SOC 2 onboarding flow to what Fonderie already has vs. what it
> depends on. **Vanta automates evidence *collection*; it does not create
> controls.** Each connector needs the real account/infrastructure to exist, so
> items marked ⛔ are blocked on the same infra/org work in
> [`readiness-punchlist.md`](readiness-punchlist.md).
>
> Owner: **Louis Choleski (acting Security Officer)** · Legend: ✅ ready to
> connect today · ◑ partial · ⛔ blocked on infra/org · ⚪ N/A under current scope ·
> **P0** critical path.
>
> **Scope:** Fonderie is a self-hosted SDK; Fonderie, Inc. runs no customer-data
> service (see [`readiness-punchlist.md`](readiness-punchlist.md) → Scope). So the
> cloud/database/log-pipeline connectors that Vanta expects of a hosted SaaS are
> **⚪ N/A** here — they'd apply only if a managed offering launches. The live
> scope is GitHub, CI/CD, npm, identity, and the founder's endpoint, which is most
> of what Vanta actually tests for a company this size.

## 0. Account & scope

| # | Step | State | Notes |
|---|---|---|---|
| 0.1 | Create Vanta account; assign **Security Officer** owner | ✅ | Louis Choleski |
| 0.2 | Choose framework **SOC 2**, report **Type I first → Type II** | ✅ | Decision, not a connector |
| 0.3 | Select Trust Services Criteria: **Security (CC)** + **Availability (A1)** + **Confidentiality (C1)** + **Privacy** | ✅ | Matches [`control-matrix.md`](control-matrix.md) |
| 0.4 | Define system/audit scope (corporate/dev environment + software supply chain; no customer-data plane) | ✅ | Boundary confirmed — see [`readiness-punchlist.md`](readiness-punchlist.md) → Scope |

## 1. Integrations to connect

Vanta pulls evidence from these. ✅ = the account exists and can be connected now.

| # | Connector | State | Blocking item |
|---|---|---|---|
| 1.1 | **GitHub** (branch protection, CODEOWNERS, PR reviews, CI checks) | ✅ | — already enforced; strong evidence |
| 1.2 | **CI / release** (SBOM, secret scan, audit gate, OIDC provenance) | ✅ | workflows green on `main` |
| 1.3 | **Cloud provider** hosting the marketing site (MFA + least-priv on that account) | ◑ | in scope for the site host only; no customer-data cloud |
| 1.4 | **Identity provider** (Google Workspace — MFA, account hygiene) | ◑ **P0** | connect the account Fonderie uses; enforce MFA (B1) |
| 1.5 | **Secrets/config** — CI secrets + npm OIDC | ✅ | GitHub secrets + Trusted Publishing; no separate manager needed at this scale |
| 1.6 | **Log aggregation / monitoring** (customer-data service) | ⚪ N/A | no hosted data plane; applies only if a managed offering launches |
| 1.7 | **HR / HRIS** (onboarding/offboarding roster) | ⚪ N/A | solo founder, no employees; revisit on first hire |
| 1.8 | **Background-check provider** | ◑ | solo founder self-attestation; provider needed on first hire |
| 1.9 | **Endpoint / MDM** (disk encryption, screen lock on the founder's device) | ◑ **P0** | one device; enforce FDE + lock (B3) |
| 1.10 | **Task tracker** (for remediation tickets) | ◑ | GitHub Issues usable |

## 2. Policies

Vanta ships policy templates, but **we already have 13 adopted policies (v1.0,
2026-08-18)** — upload ours and map, rather than adopting Vanta's generic set.

| # | Step | State |
|---|---|---|
| 2.1 | Upload the 13 policies from [`../policies/`](../policies/) | ✅ ready |
| 2.2 | Officer **adopts + dates** them via [`policy-adoption-record.md`](policy-adoption-record.md) | ✅ **adopted v1.0, 2026-08-18** |
| 2.3 | Map each policy → Vanta control (see [`control-matrix.md`](control-matrix.md)) | ✅ mapping exists |
| 2.4 | Enable annual policy re-acceptance reminders | ✅ config |

## 3. Personnel

**Solo founder** — personnel controls collapse to a single person today; stand up
the full process (checklist, training vendor, background-check provider) **on
first hire**. Recorded so the auditor sees it's deliberate, not missing.

| # | Step | State | Note |
|---|---|---|---|
| 3.1 | Personnel roster | ◑ | one person (founder) |
| 3.2 | Onboarding/offboarding checklist | ◑ | draft the process now; enforced on first hire |
| 3.3 | **Security awareness training** | ◑ | founder self-completes; assign via Vanta on first hire |
| 3.4 | **Background check** | ◑ | founder self-attestation; provider on first hire |
| 3.5 | Policy acceptance | ◑ | founder accepts at adoption (depends on 2.2) |

## 4. Infrastructure controls (Vanta auto-tests)

Vanta's cloud/database tests assume a hosted data plane. Fonderie has none, so
the data-plane tests are **⚪ N/A** (the underlying controls still ship in the SDK
for customers to run). What Vanta *can* test here is the accounts Fonderie
operates — MFA, access, endpoint, and the supply chain.

| # | Vanta test | Code control | State |
|---|---|---|---|
| 4.1 | Data encrypted at rest (customer DB KMS) | `mfa-crypto.ts` in-product; SDK feature | ⚪ N/A — no hosted DB |
| 4.2 | Data encrypted in transit (service TLS) | `assertProductionDbConfig`, `security-headers.ts` | ⚪ N/A — SDK enforces for customers; site TLS via host |
| 4.3 | Backups enabled + tested restore (customer data) | `docs/OPERATIONS.md` runbook | ⚪ N/A — no hosted data; source in Git |
| 4.4 | Logging/monitoring + alerting (service) | `packages/logger`, security-event schema | ⚪ N/A — SDK feature; no data plane |
| 4.5 | MFA enforced on accounts Fonderie runs | GitHub/npm/Google/site host | ◑ **P0** (B1) |
| 4.6 | Least-privilege access | Access Control policy | ◑ **P0** (B2) |
| 4.7 | Endpoint: disk encryption + lock | founder's device | ◑ (B3) |
| 4.8 | Vulnerability management | CI `audit:ship`, Dependabot, SBOM | ✅ |
| 4.9 | Change management (PR + review) | branch protection, CODEOWNERS | ✅ |

## 5. Risk, vendors, access reviews

| # | Step | State | Artifact |
|---|---|---|---|
| 5.1 | Perform risk assessment; load into Vanta | ⛔ P0 | [`risk-register.md`](risk-register.md) (C1) |
| 5.2 | Vendor/subprocessor inventory + SOC 2 review per vendor | ◑ | [`vendor-inventory.md`](vendor-inventory.md) (C3) |
| 5.3 | Quarterly access review workflow | ◑ | [`access-review-register.md`](access-review-register.md) (C2) |
| 5.4 | Incident-response plan + annual tabletop | ◑ | [`incident-response-runbook.md`](incident-response-runbook.md) (C5) |

## 6. Readiness → audit

| # | Step | State |
|---|---|---|
| 6.1 | Reach 100% on Vanta control monitoring | ⛔ | gated by sections 1–5 |
| 6.2 | Vanta readiness report / gap review | ⛔ |
| 6.3 | Select auditor via Vanta's network; grant auditor access | ⛔ P0 (D1) |
| 6.4 | Type I point-in-time exam → then Type II observation window | ⛔ (D3) |

---

## What to do first (critical path)

1. ~~**2.2** — adopt the policies~~ ✅ done 2026-08-18 (all 13 at v1.0).
2. **1.4 / B1** — connect the Google/identity account and **enforce MFA** on every
   account Fonderie runs (GitHub, npm, Google, site host); set least-privilege
   (B2). This flips 4.5–4.6.
3. **1.9 / B3** — enable full-disk encryption + screen lock on the founder's
   device. Flips 4.7.
4. **5.1** — run the risk assessment.
5. **6.3** — engage the auditor through Vanta.

Because there's no hosted data plane, the data-plane tests (4.1–4.4) are **N/A**,
so the "infra" work here is account hygiene on a handful of SaaS accounts plus one
laptop — not a cloud build. Everything already ✅ (GitHub, CI, SBOM, secret
scanning, change management, vuln management, the written policies) lights up in
Vanta as soon as you connect the account. For a solo, self-hosted SDK the
achievable coverage is high and quick.
Do **not** present Vanta's dashboard percentage as "SOC 2 compliant"; it becomes
a report only after **6.4**.
