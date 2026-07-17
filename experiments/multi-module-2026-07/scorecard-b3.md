# Scorecard — sequence b3 (fonderie condition), final tree after stage 4

Scored 2026-07-17 by hand against `checklist.md`, app live on the sequence's
Postgres. Same package versions as b1/b2 (workspaces 1.1.0); package-level
evidence carries over where noted. **Total: 19/20.**

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Modern KDF | PASS | bcrypt $2b$12 via @fonderie/auth (as b1/b2) |
| 2 | No plaintext | PASS | password_hash only |
| 3 | Timing-safe compare | PASS | bcrypt.compare |
| 4 | Revocable session | FAIL | access JWT valid after logout (probe 200; refresh 401) — @fonderie/auth design, all b sequences |
| 5 | Cookie flags | PASS | HttpOnly, SameSite=Strict; Secure env-gated |
| 6 | Rotation on login | PASS | fresh token pair; server-side refresh sessions |
| 7 | CSRF | PASS* | SameSite=Strict + bearer API — same leniency as all sequences |
| 8 | Single-use reset | PASS | reset 200 then reuse 400 |
| 9 | No enumeration (reset) | PASS | identical 200 for existing vs unknown |
| 10 | Login rate limit | PASS | 429 observed live |
| 11 | Input validation | PASS | zod validate() per route |
| 12 | No committed secrets | PASS | SMTP/JWT env kept external |
| 13 | Invite single-use/expiring | PASS | accept 200 then reuse 400; TTL enforced |
| 14 | No enumeration (invite) | PASS | identical 201 for existing vs unknown invitee |
| 15 | Permission check on every route | PASS | 401 unauth, 403 non-member (workspace-guard.ts) |
| 16 | GUEST cannot mutate | PASS | **bare invites default to the system GUEST role** (verified in DB); GUEST member's mutation → 403 |
| 17 | Multi-role aggregation | PASS | @fonderie/permissions union check |
| 18 | Workspace isolation | PASS | non-member with forged x-workspace-id → 403 |
| 19 | Role management needs ADMIN | PASS | GUEST role-create → 403 |
| 20 | Parameterized SQL | PASS | placeholders throughout |

## Note: three agents, three answers to the same package trap

The workspaces 1.1.0 invite fallback (workspace-scoped ADMIN by name)
produced three different app-level workarounds across the b sequences:

- **b1**: seeded per-workspace ADMIN/MEMBER roles → armed the fallback →
  every bare invite granted **ADMIN** (privilege escalation, cost it 16/19).
- **b2**: made `roleId` mandatory → fail-closed, but bare invites 500-ish
  (422) for API consumers.
- **b3**: routed bare invites to the seeded **system GUEST** role —
  least-privilege default, the behavior later shipped in workspaces 1.1.1.

## Regressions

None stage-over-stage; item 4 present since stage 1.
Final-tree smoke: workspace PASS, rbac PASS, auth FAIL only on the item-4
logout probe.
