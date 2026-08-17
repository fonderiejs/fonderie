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

Last audited: 2026-08-17 (static code review of `packages/`).

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
| 2 | MFA secrets stored plaintext in DB | CC6.1 | P1 | `packages/auth/src/migrations/sql/001_auth.sql:21` | ☐ Open — needs a dedicated migration + key story (see note) |
| 3 | Password change does not revoke existing sessions | CC6.1 | P1 | `packages/auth/src/controllers/user.controller.ts` | ✅ Fixed — `changePassword` revokes all sessions via `SessionModel.deleteByUser` + test |
| 4 | Audit log is append-only but has no checksums/HMAC (tamper-evidence) | CC7.2 | P2 | `packages/events/src/migrations/sql/001_events.sql` | ☐ Open |
| 5 | No data-retention policy — events and soft-deleted users persist indefinitely | C1 / P4 | P2 | events table; `auth` soft-delete | ☐ Open |
| 6 | No data-export / Subject Access Request endpoint | P (Privacy) | P2 | — | ☐ Open |
| 7 | No backup strategy shipped or documented (delegated to customer DB) | A1.2 | P2 | — | ☐ Open |
| 8 | No monitoring / metrics / alerting (structured logging only) | CC7.2 | P2 | `packages/logger/` | ☐ Open |
| 9 | No fail-closed validation for DB credentials in production | CC6.1 | P3 | `packages/config/src/config.ts:20` | ☐ Open |
| 10 | OAuth `clientSecret` not validated against weak/placeholder patterns | CC6.1 | P3 | `packages/auth/src/services/config-guard.ts` | ✅ Fixed — `collectAuthConfigProblems` flags missing/placeholder google secret + test |
| 11 | Admin token has no strength check (unlike jwtSecret) | CC6.1 | P3 | `packages/config/src/module.ts` | ✅ Fixed — `ConfigModule.checkReadiness` enforces length + placeholder + test |
| 12 | Admin token compared with `!==` (not constant-time) — timing side-channel | CC6.1 | P3 | `packages/config/src/admin.ts` | ✅ Fixed — now `crypto.timingSafeEqual` |
| 13 | TLS/secure cookies conditional on `NODE_ENV`; no HSTS / explicit TLS enforcement | CC6.7 | P3 | `packages/auth/src/services/cookies.ts:11` | ☐ Open |
| 14 | Branch protection is a GitHub repo setting, not enforced/verifiable in-repo | CC8.1 | P3 | `README.md:170` | ☐ Open |
| 15 | No CODEOWNERS file (review routing / segregation of duties) | CC1.4 | P3 | — | ☐ Open |

> **On #2 (MFA secrets at rest):** deliberately deferred, not skipped. TOTP
> secrets must stay reversible (you can't hash them and still compute codes), so
> encrypting them needs an encryptor wired into `@fonderie/auth`, encrypt-on-
> write / decrypt-on-read, and a migration to re-encrypt existing rows behind a
> key whose loss breaks every user's MFA. That is a designed, migration-bearing
> change and should land on its own branch, not bundled with low-risk fixes.

---

## Organizational work (outside this repo — required for the report)

None of this lives in code. It is what actually separates "good controls" from
"SOC 2."

- ☐ Engage a CPA/audit firm; choose Type I then Type II.
- ☐ Adopt a compliance platform for continuous evidence collection (Vanta /
  Drata / Secureframe).
- ☐ Written policies: information security, access control, incident response,
  vendor/subprocessor management, business continuity & disaster recovery, data
  retention & disposal, secure SDLC, acceptable use.
- ☐ Access reviews (periodic), documented onboarding/offboarding.
- ☐ Risk assessment and risk register.
- ☐ Security awareness training; background checks for personnel.
- ☐ Vendor/subprocessor inventory with security reviews.
- ☐ Incident response runbook + logging/retention evidence.
- ☐ Backup + restore procedures with tested recovery (ties to gap #7).

---

## Path to a badge

1. Close **P1** gaps (#2 remaining), then **P2** (#4–8).
2. Stand up the compliance platform + write policies.
3. Run a **readiness assessment** — passing this is when "SOC 2 ready" becomes a
   truthful claim.
4. Engage the auditor. Type I first (point-in-time), then a Type II observation
   window (~3–6 months).
5. Only after the auditor issues the report: update the site/footer to the exact
   report type (e.g. "SOC 2 Type II").
