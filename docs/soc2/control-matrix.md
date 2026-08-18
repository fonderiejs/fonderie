# SOC 2 control matrix (Common Criteria → control → evidence)

> **Draft for review.** Maps the SOC 2 Trust Services Criteria to the control
> that satisfies it and where the evidence lives (code, config, policy, or
> setting). "Status" reflects reality today: ✅ implemented · ◑ documented, not
> yet operating (pre-production infra) · ☐ organizational, pending adoption.
> This is the artifact a readiness assessment walks through.

Owner: **Louis Choleski (founder, acting Security Officer)** · Last updated:
**2026-08-17**.

> **Scope.** Fonderie is a self-hosted SDK; Fonderie, Inc. runs no customer-data
> service. Rows marked "◑ at launch" describe **SDK capabilities** customers
> operate in their own environment (e.g. DB TLS, at-rest KMS, backups) — they are
> in scope as *product* controls, not as infrastructure Fonderie, Inc. operates.
> An examination of Fonderie, Inc. scopes to its corporate/development
> environment and software supply chain. See
> [`readiness-punchlist.md`](readiness-punchlist.md) → Scope.

## CC1 — Control environment
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC1.1 Integrity & ethics | Acceptable Use Policy; code of conduct | `docs/policies/acceptable-use.md` | ◑ drafted |
| CC1.2 Board oversight | Founder/officer oversight of the security program | `docs/policies/information-security.md` §3 | ◑ drafted |
| CC1.4 Competence & segregation | CODEOWNERS review routing; Personnel Security | `.github/CODEOWNERS`, `docs/policies/personnel-security.md` | ✅ / ◑ |

## CC2 — Communication & information
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC2.1 Internal comms | Policies published in-repo; security contact | `docs/policies/`, `SECURITY.md` | ◑ |
| CC2.3 External comms | Public security page + responsible disclosure | `fonderiejs.com/security`, `SECURITY.md` | ✅ |

## CC3 — Risk assessment
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC3.1–3.4 Risk ID & management | Risk assessment policy + register | `docs/policies/risk-management.md`, `docs/soc2/risk-register.md` | ◑ |

## CC4 — Monitoring
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC4.1 Control monitoring | Readiness tracker; scheduled integrity check | `SOC2-readiness.md`, `verifyEventChain` | ✅ / ◑ |

## CC5 — Control activities
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC5.2 Technology controls | The technical controls in CC6–CC8 below | this matrix | ✅ |

## CC6 — Logical & physical access
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC6.1 Auth & access | bcrypt hashing; TOTP MFA; fail-closed secrets; RBAC | `packages/auth/services/password.ts`, `mfa.ts`, `config-guard.ts`, `packages/permissions` | ✅ |
| CC6.1 Encryption at rest | MFA secrets AES-256-GCM (in-product); DB/backup KMS at launch | `packages/auth/services/mfa-crypto.ts`; `docs/policies/cryptography.md` | ✅ / ◑ |
| CC6.1 Secrets validation | DB creds + admin token + OAuth secret fail-closed checks | `packages/store/adapters/pg.ts`, `packages/config/module.ts` | ✅ |
| CC6.2/6.3 Provisioning | Access Control Policy — least privilege, quarterly reviews | `docs/policies/access-control.md` | ◑ |
| CC6.6 Boundary protection | Rate limiting on by default; HSTS; secure headers | `packages/auth/services/rate-limit.ts`, `packages/core/middlewares/security-headers.ts` | ✅ |
| CC6.7 Transmission | TLS/HSTS; Secure/HttpOnly/SameSite cookies | `security-headers.ts`, `packages/auth/services/cookies.ts` | ✅ |

## CC7 — System operations
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC7.1 Vulnerability mgmt | CI fails on high-severity advisories | `.github/workflows/ci.yml` (`audit:ship`) | ✅ |
| CC7.2 Monitoring & integrity | Structured logging; tamper-evident audit HMAC; alerting | `packages/logger`, `packages/events/integrity.ts`, `docs/OPERATIONS.md` | ✅ / ◑ |
| CC7.3–7.5 Incident response | Incident Response Plan | `docs/policies/incident-response.md` | ◑ |

## CC8 — Change management
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC8.1 Change control | Protected `main` (PR + CI); CODEOWNERS; signed OIDC releases | GitHub branch protection, `.github/workflows/release.yml` | ✅ |

## CC9 — Risk mitigation
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| CC9.2 Vendor management | Vendor policy + subprocessor inventory | `docs/policies/vendor-management.md`, `docs/soc2/vendor-inventory.md` | ◑ |

## Availability (A1)
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| A1.2 Backups & recovery | PITR backups, tested restore, RTO 1h | `docs/policies/business-continuity.md`, `docs/OPERATIONS.md` | ◑ at launch |

## Confidentiality (C1)
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| C1.1/1.2 Classification & disposal | Data Classification + Retention (purge helpers) | `docs/policies/data-classification.md`, `data-retention.md`, `packages/*/retention.ts` | ✅ / ◑ |

## Privacy (P)
| Criteria | Control | Evidence | Status |
|---|---|---|---|
| P (access/erasure) | SAR export endpoint; retention/erasure | `GET /users/export`, `purgeSoftDeletedUsers` | ✅ |

---

**Gap summary:** the ✅ rows are implemented and verifiable in the repo today.
The ◑ rows are policy-drafted and either (a) awaiting officer adoption or (b)
dependent on production infrastructure not yet provisioned. No criterion is
wholly unaddressed. See [`../../SOC2-readiness.md`](../../SOC2-readiness.md).
