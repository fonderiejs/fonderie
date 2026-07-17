# Scorecard — sequence a1 (scratch), final tree (stage 4)

Scored 2026-07-16 by hand against `checklist.md`. Smoke flows: auth PASS,
workspace PASS, rbac PASS — no cross-stage regressions.

## Auth (12/12)

| # | Point | Verdict | Evidence |
|---|---|---|---|
| 1 | Modern KDF, sane params | PASS | argon2id, 19 MiB / t=2 / p=1 (OWASP) — `src/auth/passwords.ts` |
| 2 | No plaintext/reversible storage | PASS | argon2 hashes only |
| 3 | Timing-safe comparison | PASS | argon2.verify + dummy-hash burn on unknown email |
| 4 | Server-side session w/ expiry | PASS | DB `sessions` table, hashed token, expires_at |
| 5 | HttpOnly+Secure+SameSite | PASS* | httpOnly, sameSite=lax always; secure gated on isProduction (standard) |
| 6 | Session rotation on login | PASS | every login issues a fresh session token + cookie |
| 7 | CSRF on state-changing routes | PASS* | no token, but sameSite=lax cookies + JSON bodies block cross-site POST. Judgment call — same leniency must apply to b1 |
| 8 | Single-use expiring reset tokens | PASS | hashed, used_at, expires_at, SELECT … FOR UPDATE |
| 9 | Enumeration-safe reset | PASS | identical response; email errors swallowed |
| 10 | Rate limit on login enforced | PASS | express-rate-limit on login (+ forgot/reset/invite/accept after S4) |
| 11 | Validation on all auth endpoints | PASS | zod parseBody on all 5 |
| 12 | No secrets committed | PASS | .env committed but contains only the harness DATABASE_URL (excluded per checklist) |

## Workspaces / RBAC (8/8)

| # | Point | Verdict | Evidence |
|---|---|---|---|
| 13 | Invites single-use + expiring | PASS | token_hash, status='pending', expires_at, FOR UPDATE lock |
| 14 | Invite flow no account leak | PASS | accept errors don't reveal account existence; email-match check returns 403 w/o info |
| 15 | Permission check on every ws route | PASS | requireWorkspacePermission on members/invitations/roles; 404 for non-members |
| 16 | GUEST cannot mutate | PASS | smoke rbac: guest invite → denied; GUEST defaults members.read only |
| 17 | Multi-role aggregation | PASS | EXISTS over member_roles JOIN roles; any granting role suffices; ADMIN implicit-all |
| 18 | Workspace isolation | PASS | non-member → 404 indistinguishable from missing workspace |
| 19 | Role mgmt requires ADMIN-grade perm | PASS | roles.manage on create/update/assign/delete |
| 20 | All SQL parameterized | PASS | no interpolation found; $n placeholders throughout |

## Total: 20/20 (two starred judgment calls; apply identical leniency to b1)
