# Risk register

> **Draft for review.** Initial security & availability risk register per the
> [Risk Management Policy](../policies/risk-management.md). Review at least
> quarterly and on major change. Likelihood/Impact: Low / Med / High.
> Treatment: Mitigate / Accept / Transfer / Avoid.

Owner: **Louis Choleski (founder, acting Security Officer)** · Last reviewed:
**2026-08-17** · Next review: **[+3 months]**.

| # | Risk | Likelihood | Impact | Treatment | Mitigation / control | Owner | Status |
|---|------|:--:|:--:|:--:|------|------|------|
| R1 | Credential theft / account takeover of a user | Med | High | Mitigate | MFA (TOTP + backup codes), bcrypt hashing, session revocation on password change, rate limiting | Louis Choleski | Controlled |
| R2 | Weak/leaked signing or DB secret in production | Low | High | Mitigate | Fail-closed boot validation (jwtSecret, DB URL, admin token, OAuth secret) | Louis Choleski | Controlled |
| R3 | Cross-tenant data leakage | Low | High | Mitigate | Workspace-scoped RBAC, tenant-isolated parameterized queries + tests | Louis Choleski | Controlled |
| R4 | Tampering with the audit/event log | Low | Med | Mitigate | Keyed per-event HMAC + scheduled `verifyEventChain` | Louis Choleski | Controlled |
| R5 | Vulnerable dependency shipped | Med | Med | Mitigate | CI fails on high-severity advisories (`audit:ship`) | Louis Choleski | Controlled |
| R6 | Compromised release / supply chain | Low | High | Mitigate | OIDC Trusted Publishing + SLSA provenance; protected `main`; no long-lived tokens | Louis Choleski | Controlled |
| R7 | Unreviewed change reaching production | Low | Med | Mitigate | Branch protection (PR + required CI), CODEOWNERS routing | Louis Choleski | Controlled |
| R8 | Data loss (no backups) before launch | High | High | Mitigate | **Open** — provision managed Postgres with PITR + tested restore before production launch | Louis Choleski | **Open (pre-launch)** |
| R9 | Undetected incident (no monitoring) before launch | High | Med | Mitigate | **Open** — stand up log collector + alerting before production launch | Louis Choleski | **Open (pre-launch)** |
| R10 | Secrets stored plaintext at rest (no KMS/encryptor) | Med | High | Mitigate | **Open** — configure `secretEncryptor` + managed KMS at production launch (readiness warns today) | Louis Choleski | **Open (pre-launch)** |
| R11 | Subprocessor breach (e.g. Stripe/GitHub) | Low | High | Transfer/Mitigate | Vendor review + DPAs; minimal data shared; inventory maintained | Louis Choleski | Controlled |
| R12 | Key person dependency (single founder) | High | Med | Accept/Mitigate | Documented runbooks (`OPERATIONS.md`, policies); expand team + reviewers as it grows | Louis Choleski | Accepted (monitored) |
| R13 | Loss of MFA encryption key | Low | Med | Mitigate | Documented key management (Cryptography Policy); losing it forces user re-enrollment | Louis Choleski | Controlled |

---

**Top open risks** are the three pre-launch infrastructure items (R8 backups,
R9 monitoring, R10 at-rest KMS) — all resolved by provisioning production
infrastructure, tracked in [`../../SOC2-readiness.md`](../../SOC2-readiness.md)
and [`../OPERATIONS.md`](../OPERATIONS.md).
