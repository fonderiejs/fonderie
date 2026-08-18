# Vanta onboarding checklist

> Maps Vanta's SOC 2 onboarding flow to what Fonderie already has vs. what it
> depends on. **Vanta automates evidence *collection*; it does not create
> controls.** Each connector needs the real account/infrastructure to exist, so
> items marked ⛔ are blocked on the same infra/org work in
> [`readiness-punchlist.md`](readiness-punchlist.md).
>
> Owner: **Louis Choleski (acting Security Officer)** · Legend: ✅ ready to
> connect today · ◑ partial · ⛔ blocked on infra/org · **P0** critical path.

## 0. Account & scope

| # | Step | State | Notes |
|---|---|---|---|
| 0.1 | Create Vanta account; assign **Security Officer** owner | ✅ | Louis Choleski |
| 0.2 | Choose framework **SOC 2**, report **Type I first → Type II** | ✅ | Decision, not a connector |
| 0.3 | Select Trust Services Criteria: **Security (CC)** + **Availability (A1)** + **Confidentiality (C1)** + **Privacy** | ✅ | Matches [`control-matrix.md`](control-matrix.md) |
| 0.4 | Define system/audit scope (the `@fonderie/*` platform + prod infra) | ◑ | Code scope defined; infra scope pending provisioning |

## 1. Integrations to connect

Vanta pulls evidence from these. ✅ = the account exists and can be connected now.

| # | Connector | State | Blocking item |
|---|---|---|---|
| 1.1 | **GitHub** (branch protection, CODEOWNERS, PR reviews, CI checks) | ✅ | — already enforced; strong evidence |
| 1.2 | **CI / release** (SBOM, secret scan, audit gate, OIDC provenance) | ✅ | workflows green on `main` |
| 1.3 | **Cloud provider** (AWS/GCP — encryption, backups, logging, MFA) | ⛔ P0 | infra B1–B3, B7 not provisioned |
| 1.4 | **Identity provider** (Google Workspace / Okta — SSO, MFA, offboarding) | ⛔ P0 | IdP not stood up (B7) |
| 1.5 | **Secrets/config** (secrets manager) | ⛔ | infra B4 |
| 1.6 | **Log aggregation / monitoring** | ⛔ | infra B5 |
| 1.7 | **HR / HRIS** (onboarding/offboarding roster) | ⛔ | personnel process C4 |
| 1.8 | **Background-check provider** | ⛔ | personnel process C4 |
| 1.9 | **Endpoint / MDM** (disk encryption, screen lock on laptops) | ⛔ | endpoint mgmt not set up |
| 1.10 | **Task tracker** (for remediation tickets) | ◑ | GitHub Issues usable |

## 2. Policies

Vanta ships policy templates, but **we already have 13 drafted policies** — upload
ours and map, rather than adopting Vanta's generic set.

| # | Step | State |
|---|---|---|
| 2.1 | Upload the 13 policies from [`../policies/`](../policies/) | ✅ ready |
| 2.2 | Officer **adopts + dates** them via [`policy-adoption-record.md`](policy-adoption-record.md) | ⛔ **P0** — one signature |
| 2.3 | Map each policy → Vanta control (see [`control-matrix.md`](control-matrix.md)) | ✅ mapping exists |
| 2.4 | Enable annual policy re-acceptance reminders | ✅ config |

## 3. Personnel

| # | Step | State | Blocking item |
|---|---|---|---|
| 3.1 | Import personnel roster (via HRIS/IdP) | ⛔ | 1.4 / 1.7 |
| 3.2 | Onboarding/offboarding checklist enforced | ⛔ | process C4 |
| 3.3 | **Security awareness training** assigned + completed | ⛔ | process C4 |
| 3.4 | **Background checks** recorded | ⛔ | process C4 |
| 3.5 | Policy acceptance by all personnel | ◑ | depends on 2.2 + roster |

## 4. Infrastructure controls (Vanta auto-tests)

These Vanta "tests" pass only once the cloud account (1.3) is connected and
configured. The technical enforcement already exists in code — see the mapped
control; the infra must operate it.

| # | Vanta test | Code control | State |
|---|---|---|---|
| 4.1 | Data encrypted at rest (KMS) | `mfa-crypto.ts` in-product; DB/backups need KMS | ⛔ B3 |
| 4.2 | Data encrypted in transit (TLS) | `assertProductionDbConfig`, `security-headers.ts` | ⛔ B1 |
| 4.3 | Backups enabled + tested restore | `docs/OPERATIONS.md` runbook | ⛔ B2 |
| 4.4 | Logging/monitoring + alerting | `packages/logger`, security-event schema | ⛔ B5 |
| 4.5 | MFA enforced on cloud console | — | ⛔ B7 |
| 4.6 | Least-privilege IAM | Access Control policy | ⛔ B7 |
| 4.7 | Vulnerability management | CI `audit:ship`, Dependabot, SBOM | ✅ |
| 4.8 | Change management (PR + review) | branch protection, CODEOWNERS | ✅ |

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

1. **2.2** — adopt the policies (one signature).
2. **1.3 / 1.4 / B7** — stand up the cloud account + IdP with MFA and least-priv IAM; connect both to Vanta. This alone flips most of section 4 green.
3. **B1–B3** — TLS Postgres, PITR backups, KMS. Flips 4.1–4.3.
4. **5.1** — run the risk assessment.
5. **6.3** — engage the auditor through Vanta.

Everything in ✅ today (GitHub, CI, SBOM, secret scanning, change management,
vuln management, the written policies) will light up in Vanta as soon as the
account is connected — the codebase controls are the easy 30–40% you already own.
Do **not** present Vanta's dashboard percentage as "SOC 2 compliant"; it becomes
a report only after **6.4**.
