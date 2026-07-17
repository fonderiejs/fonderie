# Scorecard — sequence a2 (scratch condition), final tree after stage 4

Scored 2026-07-17 by hand against `checklist.md`, app live on the sequence's
Postgres. **Total: 20/20.**

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Modern KDF | PASS | argon2id, m=19456 t=2 p=1 (OWASP minimum), hash observed in DB |
| 2 | No plaintext | PASS | only `password_hash` column |
| 3 | Timing-safe compare | PASS | argon2.verify + dummy-hash verify on unknown email |
| 4 | Revocable session | PASS | server-side sessions table; probe after logout → 401 |
| 5 | Cookie flags | PASS | HttpOnly, SameSite=Lax, Secure gated on NODE_ENV=production |
| 6 | Rotation on login | PASS | fresh session token per login |
| 7 | CSRF | PASS* | no token, but SameSite cookies + JSON bodies — same leniency as a1/b1 |
| 8 | Single-use reset | PASS | confirm 200 then reuse 400 |
| 9 | No enumeration (reset) | PASS | identical 200/body for existing vs unknown email |
| 10 | Login rate limit | PASS | 429 observed live after repeated failures (per-IP, in-memory) |
| 11 | Input validation | PASS | 400 with field errors on bad email/short password |
| 12 | No committed secrets | PASS | grep clean; `.env` is harness infrastructure |
| 13 | Invite single-use/expiring | PASS | accept 200 then reuse 400; expires_at +7d; token stored hashed |
| 14 | No enumeration (invite) | PASS | identical `{"ok":true,expiresAt}` for existing vs unknown invitee |
| 15 | Permission check on every route | PASS | 401 unauthenticated; per-route hasPermission() spot-checked |
| 16 | GUEST cannot mutate | PASS | invited member's invite attempt → 403; smoke RBAC PASS |
| 17 | Multi-role aggregation | PASS | hasPermission is EXISTS-over-any-role (union); ADMIN implicit superset |
| 18 | Workspace isolation | PASS | non-member reading another workspace's members → 404 |
| 19 | Role management needs ADMIN | PASS | member role-create → 403; roles.manage/roles.assign keys |
| 20 | Parameterized SQL | PASS | all queries use placeholders; no interpolation in src/ |

## Regressions

None: final-tree smoke auth PASS, workspace PASS, rbac PASS.
