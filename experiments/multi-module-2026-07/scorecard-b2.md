# Scorecard — sequence b2 (fonderie condition), final tree after stage 4

Scored 2026-07-17 by hand against `checklist.md`, app live on the sequence's
Postgres. Same package versions as b1, so package-level evidence carries
over where noted. **Total: 19/20.**

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Modern KDF | PASS | bcrypt $2b$12 via @fonderie/auth (as b1) |
| 2 | No plaintext | PASS | password_hash only |
| 3 | Timing-safe compare | PASS | bcrypt.compare (as b1) |
| 4 | Revocable session | FAIL | access JWT valid after logout (probe 200; refresh 401) — @fonderie/auth design, as b1 |
| 5 | Cookie flags | PASS | HttpOnly, SameSite=Strict; Secure env-gated (as b1) |
| 6 | Rotation on login | PASS | fresh token pair per login; sessions tracked server-side |
| 7 | CSRF | PASS* | SameSite=Strict + bearer API — same leniency as other sequences |
| 8 | Single-use reset | PASS | reset 200 then reuse 400 |
| 9 | No enumeration (reset) | PASS | identical 200 for existing vs unknown |
| 10 | Login rate limit | PASS | 429 after 6 bad logins observed live |
| 11 | Input validation | PASS | zod validate() per route (as b1) |
| 12 | No committed secrets | PASS | agent-written code clean; b2 keeps SMTP/JWT env external (not even in .env) |
| 13 | Invite single-use/expiring | PASS | accept 200 then reuse 400; 7d TTL |
| 14 | No enumeration (invite) | PASS | identical 201 for existing vs unknown invitee |
| 15 | Permission check on every route | PASS | 401 unauth, 403 non-member; per-route rule table in workspace-permissions.ts |
| 16 | GUEST cannot mutate | PASS | invitations require an explicit roleId (no default role); GUEST member's invite → 403. Avoids b1's default-ADMIN bug |
| 17 | Multi-role aggregation | PASS | @fonderie/permissions union check (as b1) |
| 18 | Workspace isolation | PASS | non-member with forged x-workspace-id → 403 |
| 19 | Role management needs ADMIN | PASS | GUEST role-create → 403; superRole ADMIN |
| 20 | Parameterized SQL | PASS | store adapter placeholders; no interpolation in src/ |

## Regressions

None stage-over-stage. Item 4 present since stage 1 (package design).
Final-tree smoke: workspace PASS, rbac PASS, auth FAIL only on the item-4
logout probe.

## Harness note

b2 requires an explicit `roleId` in invite bodies; the smoke harness gained
a `WS_INVITE_BODY` template (assertions unchanged). The b2 map pins the
seeded GUEST role id.
