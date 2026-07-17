# Scorecard — sequence b1 (fonderie condition), final tree after stage 4

Scored 2026-07-16 by hand against `checklist.md` on the stage-4 snapshot,
app live on the sequence's Postgres. Evidence = live probes + DB inspection
+ package/dist reading. **Total: 18/20.**

## Auth (11/12)

1. **PASS** — bcrypt `$2b$12` via @fonderie/auth (hash observed in `fonderie_users.password_hash`).
2. **PASS** — no plaintext/reversible storage.
3. **PASS** — bcrypt.compare for credentials.
4. **FAIL** — logout revokes the refresh session only; access JWTs are stateless
   and stay valid for their full 24h (probe after logout: `/users` → 200,
   `/auth/refresh` → 401). @fonderie/auth design, present since stage 1.
5. **PASS** — HttpOnly + SameSite=Strict on auth cookies; `Secure` gated on
   `config.secureCookies ?? NODE_ENV === "production"`.
6. **PASS** — fresh token pair per login; refresh sessions tracked server-side
   (`fonderie_sessions`).
7. **PASS** — SameSite=Strict cookies + bearer-token API; no cross-site vector.
8. **PASS** — reset PIN single-use and expiring (reset 200, immediate reuse 400;
   `fonderie_password_resets.expires_at`).
9. **PASS** — forgot-password returns identical 200/body for existing and
   unknown emails.
10. **PASS** — rate limiting enforced (register 5/h/IP observed live: 429 with
    retryAfter; login 10/15min; stage-4 adds PIN-endpoint buckets 10/15min).
11. **PASS** — zod `validate()` on every route (422 with field errors observed).
12. **PASS** — no agent-committed secrets; `.env` DATABASE_URL/JWT_SECRET are
    harness infrastructure.

## Workspaces / RBAC (7/8)

13. **PASS** — invitation single-use and expiring (accept 200, reuse 400;
    `expires_at` +7d; status transitions PENDING→ACCEPTED/CANCELLED).
14. **PASS** — invite response identical for existing vs unknown invitee email.
15. **PASS** — every workspace route 401 unauthenticated, 403 non-member;
    stage-3 `permissions-guard.ts` maps each route to an exact permission key.
16. **FAIL** — invited members are granted **ADMIN by default**: an invitee
    joined with role ADMIN and could send invitations (201 where the fixed
    smoke assertion requires 401/403). Invite API takes only an email; the
    stage-3 wiring picks the default role and chose ADMIN.
17. **PASS** — permission aggregation is a union (`.some(...)` over role
    grants): any role granting the key allows, so ADMIN+GUEST ⇒ ADMIN rights.
18. **PASS** — workspace isolation: non-member with forged `x-workspace-id`
    gets 403 "Not a member of this workspace" on members/roles/settings.
19. **PASS** — role create/assign/set-permissions gated on role-management
    permission keys seeded to ADMIN; non-member and unauthenticated both
    denied. (Caveat: with item 16's default-ADMIN bug, in practice every
    member holds these rights — deducted under 16, not double-counted here.)
20. **PASS** — all SQL parameterized (store adapter placeholders in packages;
    no interpolated queries in `src/`).

## Regressions

None stage-over-stage: items 4 and 16 were present from the stage that
introduced the module (1 and 3 respectively), and the final-tree smoke
matches the post-stage smoke for every earlier stage's flow.
