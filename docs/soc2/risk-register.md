# Risk register

> Security, availability, and supply-chain risk assessment per the
> [Risk Management Policy](../policies/risk-management.md).

Owner: **Louis Choleski (founder, acting Security Officer)** · Assessment
performed: **2026-08-18** · Next review: **2026-11-18** (quarterly) and on
material change.

## Method & scope

**Scope** (per [`readiness-punchlist.md`](readiness-punchlist.md) → Scope):
Fonderie, Inc. is a self-hosted SDK; it operates **no customer-data service**.
This assessment covers the assets Fonderie, Inc. actually owns — the source code,
the **software supply chain** (GitHub, CI/CD, npm publishing), corporate SaaS,
the founder's endpoint, and identity — plus the **product-security** risks the
SDK is responsible for on its customers' behalf. Risks that belong to a hosted
data plane are out of scope unless a managed offering launches (see R14–R16).

**Assets:** source repo · npm publish rights · GitHub org · Google/identity ·
founder endpoint · domain/DNS (fonderiejs.com) · release pipeline · the SDK's own
security controls.

**Scoring:** Likelihood and Impact each **Low / Med / High**; the risk level is
their product. **Treatment:** Mitigate / Accept / Transfer / Avoid. **Status:**
Controlled (residual acceptable) · Monitored · **Open** (remediation outstanding).

## Register

### Supply chain & corporate environment (in scope — Fonderie-operated)

| # | Risk | L | I | Treatment | Mitigation / control | Status |
|---|------|:--:|:--:|:--:|------|------|
| R1 | **Account takeover of Fonderie's npm publish rights** → malicious package to all customers | Med | High | Mitigate | OIDC Trusted Publishing (no long-lived npm token); **enforce MFA on npm + GitHub (punch-list B1)** | **Open — B1** |
| R2 | **Takeover of the GitHub org** → malicious merge/release | Med | High | Mitigate | Branch protection (PR + required CI), CODEOWNERS, SHA-pinned actions; **enforce MFA + least-priv (B1/B2)** | **Open — B1/B2** |
| R3 | **Founder endpoint compromise** (single device holds all keys) | Med | High | Mitigate | **Full-disk encryption + screen lock + auto-update (B3)**; OIDC means no static publish token on disk | **Open — B3** |
| R4 | **Phishing / social engineering** of the solo founder | Med | High | Mitigate | MFA everywhere (phishing-resistant where possible), least standing access, awareness | Monitored |
| R5 | **Compromised release / build tampering** | Low | High | Mitigate | OIDC + SLSA provenance, protected `main`, no self-hosted runners, reproducible `npm ci` | Controlled |
| R6 | **Vulnerable/malicious dependency** in the SDK or toolchain | Med | Med | Mitigate | CI `audit:ship` (fails on high sev), Dependabot (grouped, majors reviewed), SBOM, secret scanning | Controlled |
| R7 | **Unreviewed change reaching a release** | Low | Med | Mitigate | Branch protection, required `test` check, CODEOWNERS, changesets flow | Controlled |
| R8 | **Committed secret** in the repo | Low | Med | Mitigate | gitleaks in CI + GitHub push protection; no long-lived tokens to leak | Controlled |
| R9 | **Domain / DNS takeover** (fonderiejs.com) | Low | Med | Mitigate | Registrar MFA + lock; DNS provider MFA; monitor expiry | Monitored |

### Product security (SDK responsibility on customers' behalf)

| # | Risk | L | I | Treatment | Mitigation / control | Status |
|---|------|:--:|:--:|:--:|------|------|
| R10 | Credential theft / account takeover of an end user | Med | High | Mitigate | MFA (TOTP + backup codes), bcrypt, session revocation on password change, rate limiting | Controlled |
| R11 | Weak/leaked signing or DB secret in a customer deployment | Low | High | Mitigate | Fail-closed boot validation (jwtSecret, DB URL, admin token, OAuth secret) | Controlled |
| R12 | Cross-tenant data leakage | Low | High | Mitigate | Workspace-scoped RBAC + tenant-isolated parameterized queries + tests (F2) | Controlled |
| R13 | Tampering with a customer's audit/event log | Low | Med | Mitigate | Keyed per-event HMAC + scheduled `verifyEventChain` | Controlled |

### Out of scope today (hosted data plane — revisit only if a managed offering launches)

| # | Risk | L | I | Treatment | Note | Status |
|---|------|:--:|:--:|:--:|------|------|
| R14 | Customer-data loss (backups) | — | — | — | Customer's own DB today; the SDK ships retention/disposal helpers. Fonderie holds no customer data. | N/A (SDK-only) |
| R15 | Undetected incident in a hosted service | — | — | — | No hosted data plane to monitor; the SDK emits a security-event schema customers wire to their own alerting. | N/A (SDK-only) |
| R16 | Customer data at rest without KMS | — | — | — | Customer operates their DB/KMS; the SDK encrypts MFA secrets in-product (AES-256-GCM). | N/A (SDK-only) |

### Organizational

| # | Risk | L | I | Treatment | Mitigation / control | Status |
|---|------|:--:|:--:|:--:|------|------|
| R17 | **Key-person dependency** (single founder / bus factor) | High | Med | Accept/Mitigate | Documented runbooks + policies; recovery access for domain/npm/GitHub recorded; expand reviewers as team grows | Accepted (monitored) |
| R18 | Subprocessor breach (GitHub, npm, Stripe, Google) | Low | High | Transfer/Mitigate | Vendor review + DPAs, minimal data shared, [vendor inventory](vendor-inventory.md) maintained | Monitored |
| R19 | Loss of the MFA at-rest encryption key (SDK feature) | Low | Med | Mitigate | Key management per [Cryptography Policy](../policies/cryptography.md); loss forces user re-enrollment, no data disclosure | Controlled |

---

## Top risks & treatment plan

The residual risk is concentrated in **the software supply chain and the single
operator** — appropriate for a solo, self-hosted SDK vendor. The three **Open**
items all resolve with account/endpoint hygiene, not infrastructure:

1. **R1 / R2 — enforce MFA and least-privilege** on npm, GitHub, and Google
   (punch-list **B1/B2**). Highest priority: a publish-rights takeover reaches
   every customer.
2. **R3 — harden the founder's endpoint** (full-disk encryption, screen lock,
   auto-update; **B3**).
3. **R17 — key-person dependency** is *accepted and monitored*: record recovery
   access for the domain, npm, and GitHub org so a single lost account or person
   is survivable; revisit on first hire.

Everything else is **Controlled** or **N/A under current scope**. This assessment
is recorded by the acting Security Officer; re-run quarterly (next **2026-11-18**)
and on any material change (first hire, a managed offering, a new subprocessor).
