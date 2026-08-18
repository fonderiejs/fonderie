# SOC 2 readiness

**Status: not certified. Not yet ready for audit.**

SOC 2 is an attestation issued by an independent CPA firm after examining how
the *company* operates its controls over time (Type I = point-in-time, Type II
= a 3–12 month observation window). No codebase can confer it. This file tracks
the technical control gaps in the `@fonderie/*` architecture that a SOC 2
auditor would test, plus the organizational work that has to happen outside
this repo.

Do **not** claim "SOC 2 certified" or "SOC 2 compliant" anywhere (site, sales,
docs) until an auditor has issued a report. "SOC 2 ready" is only defensible
after a readiness assessment passes.

Last audited: 2026-08-17 (static code review of `packages/`). Controls
re-verified 2026-08-18 (drift guard resolves all evidence paths; OIDC signed
publish proven end-to-end).

**Progress:** all in-repo technical findings are addressed. Of the 15 gaps, 12
are ✅ fixed and 3 ◑ surfaced/documented (#1 at-rest encryption default, #7
backups, #8 monitoring). None remain open. What remains is **organizational**,
not code: an auditor, adopted policies, and an evidence platform (see the bottom
sections). Draft policies live in [`docs/policies/`](docs/policies/README.md); evidence
registers (control matrix, risk register, vendor inventory) in [`docs/soc2/`](docs/soc2/README.md).

**The single gating list is [`docs/soc2/readiness-punchlist.md`](docs/soc2/readiness-punchlist.md)** —
every non-code item (policy adoption, infra, operating evidence, audit
engagement) mapped to the control it gates, with a critical path to a Type I.
Policy adoption is a one-signature act via
[`docs/soc2/policy-adoption-record.md`](docs/soc2/policy-adoption-record.md).

**Scope note.** Fonderie is a **self-hosted SDK**; Fonderie, Inc. operates no
multi-tenant service and stores no end-customer data. The audit scope is the
**corporate/development environment and software supply chain**, not a hosted
data plane. Customer-data infrastructure (managed DB, KMS, PITR, service-scale
monitoring) is therefore **out of scope unless a managed offering launches** —
those remain SDK capabilities customers run in their own environment. The
in-scope "infra" reduces to MFA, access management, and endpoint hygiene on the
handful of accounts/devices Fonderie actually runs.

---

## What already exists (control substrate)

These are implemented and are genuine strengths going into an audit.

- **CC6.1 — password hashing.** bcrypt, 12 rounds, 128-char cap, rehash-on-login.
  `packages/auth/src/services/password.ts`
- **CC6.1 — secrets fail-closed.** JWT secret ≥32 chars, placeholder rejection,
  fatal in production. `packages/auth/src/services/config-guard.ts`
- **CC6.1 — MFA.** TOTP (RFC 6238) + 8 bcrypt-hashed backup codes.
  `packages/auth/src/services/mfa.ts`
- **CC6.1 — sessions.** DB-backed, `sid` revocation, refresh rotation, and now
  full revocation on password change. `packages/auth/src/middlewares/session.ts`
- **CC6.1 — RBAC + tenant isolation.** Workspace-scoped permission engine,
  parameterized queries, `workspace_id` enforced in every query.
  `packages/permissions/src/services/permissions.ts`
- **CC6.6 — boundary protection.** Rate limiting on by default (login, register,
  reset, MFA), IP + account, SHA-256 keys (no PII at rest).
  `packages/auth/src/services/rate-limit.ts`
- **CC7.1 — vulnerability management.** CI gates high+ advisories in shipped deps
  (`npm run audit:ship`); OIDC trusted publishing with provenance.
- **CC8.1 — change management.** PR flow, 10 CI checks, changesets,
  input-validation audit gate (`npm run audit:validation`).

---

## Technical gaps (in-repo, actionable)

Priority: **P1** blocks a credible readiness assessment; **P2** expected by most
auditors; **P3** hardening. Status legend: ✅ fixed · ◑ partially addressed · ☐ open.

| # | Gap | Criteria | Priority | Evidence | Status |
|---|-----|----------|----------|----------|--------|
| 1 | At-rest encryption defaults to no-op plaintext (AES-256-GCM exists but off by default) | CC6.1 | P1 | `packages/config/src/crypto.ts:14` | ◑ Surfaced — readiness warns when no `secretEncryptor` set (default kept for back-compat) |
| 2 | MFA secrets stored plaintext in DB | CC6.1 | P1 | `packages/auth/src/services/mfa-crypto.ts` | ✅ Fixed (PR #12) — TOTP secrets encrypted at rest (AES-256-GCM) under `mfaSecretKey`; lazy migration + tests |
| 3 | Password change does not revoke existing sessions | CC6.1 | P1 | `packages/auth/src/controllers/user.controller.ts` | ✅ Fixed — `changePassword` revokes all sessions via `SessionModel.deleteByUser` + test |
| 4 | Audit log is append-only but has no checksums/HMAC (tamper-evidence) | CC7.2 | P2 | `packages/events/src/integrity.ts` | ✅ Fixed (PR #17) — keyed per-event HMAC (`computeEventHmac`/`verifyEventChain`) + migration + readiness warning |
| 5 | No data-retention policy — events and soft-deleted users persist indefinitely | C1 / P4 | P2 | `auth/services/retention.ts`, `events/retention.ts` | ✅ Fixed (PR #18) — `purgeSoftDeletedUsers` + `purgeEvents` disposal helpers + tests |
| 6 | No data-export / Subject Access Request endpoint | P (Privacy) | P2 | `auth` `GET /users/export` | ✅ Fixed (PR #19) — SAR bundle (profile + session metadata, no secrets) + `SessionModel.listByUser` + tests |
| 7 | No backup strategy shipped or documented (delegated to customer DB) | A1.2 | P2 | `docs/OPERATIONS.md` | ◑ Documented — backup/restore runbook added; provisioning is the operator's |
| 8 | No monitoring / metrics / alerting (structured logging only) | CC7.2 | P2 | `docs/OPERATIONS.md` | ◑ Documented — logging→monitoring guidance added; alerting stack is the operator's |
| 9 | No fail-closed validation for DB credentials in production | CC6.1 | P3 | `packages/store/src/adapters/pg.ts` | ✅ Fixed (PR #16) — `assertProductionDbConfig`: fatal on empty conn string in prod, warns on sslmode=disable/default creds |
| 10 | OAuth `clientSecret` not validated against weak/placeholder patterns | CC6.1 | P3 | `packages/auth/src/services/config-guard.ts` | ✅ Fixed — `collectAuthConfigProblems` flags missing/placeholder google secret + test |
| 11 | Admin token has no strength check (unlike jwtSecret) | CC6.1 | P3 | `packages/config/src/module.ts` | ✅ Fixed — `ConfigModule.checkReadiness` enforces length + placeholder + test |
| 12 | Admin token compared with `!==` (not constant-time) — timing side-channel | CC6.1 | P3 | `packages/config/src/admin.ts` | ✅ Fixed — now `crypto.timingSafeEqual` |
| 13 | TLS/secure cookies conditional on `NODE_ENV`; no HSTS / explicit TLS enforcement | CC6.7 | P3 | `packages/core/src/middlewares/security-headers.ts` | ✅ Fixed (PR #16) — `withSecurityHeaders` (HSTS over HTTPS + nosniff) in default pipeline |
| 14 | Branch protection is a GitHub repo setting, not enforced/verifiable in-repo | CC8.1 | P3 | GitHub repo settings | ✅ Fixed — `main` protected: required PR + required `test` CI check + up-to-date, no direct pushes/force-pushes |
| 15 | No CODEOWNERS file (review routing / segregation of duties) | CC1.4 | P3 | `.github/CODEOWNERS` | ✅ Fixed (PR #16) |

> **On #2 (MFA secrets at rest):** done in **PR #12**. TOTP secrets stay
> reversible (you can't hash them and still compute codes), so they're now
> AES-256-GCM encrypted under an optional `IAuthSecrets.mfaSecretKey`, applied at
> the `mfa.controller` boundary. Backward-compatible: no key → passthrough; with
> a key, legacy plaintext still decrypts and re-encrypts on next MFA setup (lazy
> migration), so no SQL migration is required. Losing the key makes existing MFA
> secrets unrecoverable (users re-enroll).

---

## Documentation & evidence (in-repo)

The readiness package a company assembles before an audit. All drafted; policies
await officer adoption.

- **Readiness punch-list** (gating policy/infra/process items) — [`docs/soc2/readiness-punchlist.md`](docs/soc2/readiness-punchlist.md)
- **Policy adoption record** (one-signature adoption) — [`docs/soc2/policy-adoption-record.md`](docs/soc2/policy-adoption-record.md)
- **Operations runbook** — [`docs/OPERATIONS.md`](docs/OPERATIONS.md) (backups, monitoring, change management)
- **Policies (13)** — [`docs/policies/`](docs/policies/README.md)
- **Control matrix** (Common Criteria → control → evidence) — [`docs/soc2/control-matrix.md`](docs/soc2/control-matrix.md)
- **Risk register** — [`docs/soc2/risk-register.md`](docs/soc2/risk-register.md)
- **Vendor / subprocessor inventory** — [`docs/soc2/vendor-inventory.md`](docs/soc2/vendor-inventory.md)
- **Access-review register** — [`docs/soc2/access-review-register.md`](docs/soc2/access-review-register.md)
- **Incident-response runbook** — [`docs/soc2/incident-response-runbook.md`](docs/soc2/incident-response-runbook.md)

---

## Organizational work (outside this repo — required for the report)

None of this lives in code. It is what actually separates "good controls" from
"SOC 2." The itemized, control-mapped version is
[`docs/soc2/readiness-punchlist.md`](docs/soc2/readiness-punchlist.md); the
summary below mirrors it.

- ☐ Engage a CPA/audit firm; choose Type I then Type II.
- ☐ Adopt a compliance platform for continuous evidence collection (Vanta /
  Drata / Secureframe).
- ◑ Written policies — **13 filled drafts** in [`docs/policies/`](docs/policies/README.md)
  (info-sec, access, crypto, change mgmt, incident response, logging, BC/DR,
  retention, classification, vendor, risk, acceptable use, personnel). Remaining:
  officers **review, adopt, and date** them.
- ◑ Access reviews (periodic) — register/template in [`docs/soc2/access-review-register.md`](docs/soc2/access-review-register.md). Remaining: run reviews on cadence, log them.
- ◑ Risk assessment and register — initial draft in [`docs/soc2/risk-register.md`](docs/soc2/risk-register.md). Remaining: review & keep current.
- ☐ Security awareness training; background checks for personnel.
- ◑ Vendor/subprocessor inventory — draft in [`docs/soc2/vendor-inventory.md`](docs/soc2/vendor-inventory.md). Remaining: confirm DPAs, keep current.
- ◑ Incident response runbook — [`docs/soc2/incident-response-runbook.md`](docs/soc2/incident-response-runbook.md) + [policy](docs/policies/incident-response.md). Remaining: adopt, tabletop annually.
- ◑ Backup + restore — customer data lives in the customer's own DB (their
  responsibility; the SDK ships disposal/retention helpers). For Fonderie, Inc.
  itself: source is in Git and corporate data in SaaS; document those providers'
  backup/retention. No customer-data backup plane to operate (ties to gap #7).

---

## Path to a badge

1. In-repo controls complete (12 fixed, 3 surfaced/documented; `main` branch
   protection enforced). No code-side items remain.
2. Stand up the compliance platform + write policies.
3. Run a **readiness assessment** — passing this is when "SOC 2 ready" becomes a
   truthful claim.
4. Engage the auditor. Type I first (point-in-time), then a Type II observation
   window (~3–6 months).
5. Only after the auditor issues the report: update the site/footer to the exact
   report type (e.g. "SOC 2 Type II").
