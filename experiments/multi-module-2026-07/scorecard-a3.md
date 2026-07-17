# Scorecard — sequence a3 (scratch condition), final tree after stage 4

Scored 2026-07-17 by hand against `checklist.md`, app live on the sequence's
Postgres. **Total: 20/20.**

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Modern KDF | PASS | scrypt via node:crypto with per-user random salt (src/password.ts) |
| 2 | No plaintext | PASS | hash+salt columns only |
| 3 | Timing-safe compare | PASS | crypto.timingSafeEqual in verify |
| 4 | Revocable session | PASS | server-side sessions; probe after logout → 401; password change kills sessions (observed live — it invalidated a probe session) |
| 5 | Cookie flags | PASS | HttpOnly, SameSite=Lax, Secure gated on production |
| 6 | Rotation on login | PASS | distinct session cookie per login |
| 7 | CSRF | PASS* | SameSite + JSON bodies — same leniency as all sequences |
| 8 | Single-use reset | PASS | confirm 200 then reuse 400 |
| 9 | No enumeration (reset) | PASS | identical 200 for existing vs unknown |
| 10 | Login rate limit | PASS | 429 observed live (per-IP, in-memory; also throttled the harness) |
| 11 | Input validation | PASS | 400 on malformed email/short password |
| 12 | No committed secrets | PASS | grep clean |
| 13 | Invite single-use/expiring | PASS | accept 200 then reuse 400; 7d expiry |
| 14 | No enumeration (invite) | PASS | identical 201 for existing vs unknown invitee |
| 15 | Permission check on every route | PASS | 401 unauthenticated on workspace routes |
| 16 | GUEST cannot mutate | PASS | invited member's invite attempt → 403; smoke RBAC PASS |
| 17 | Multi-role aggregation | PASS | ADMIN wildcard `*` + union over role grants |
| 18 | Workspace isolation | PASS | non-member → 404 (existence hidden) |
| 19 | Role management needs ADMIN | PASS | guest role-create → 403 |
| 20 | Parameterized SQL | PASS | placeholders throughout; no interpolation |

## Regressions

None: final-tree smoke auth PASS, workspace PASS, rbac PASS.
