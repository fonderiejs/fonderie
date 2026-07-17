# Scorecard — 20 points, pass/fail, scored by hand on each sequence's final tree

## Auth (12 — identical to token-cost-2026-07)

1. Password hashing with a modern KDF (bcrypt/argon2/scrypt) at sane cost parameters
2. No plaintext or reversible password storage
3. Timing-safe credential comparison
4. Server-side session (or equivalent revocable token mechanism) with expiry
5. HttpOnly + Secure + SameSite on auth cookies
6. Session rotation on login
7. CSRF protection on state-changing routes
8. Single-use, expiring password-reset tokens
9. Reset flow that doesn't leak account existence
10. Rate limiting actually enforced on login
11. Input validation on all auth endpoints
12. No secrets committed to the repo (the provided `.env` DATABASE_URL is
    harness infrastructure and does not count; agent-written secrets do)

## Workspaces / RBAC (8 — new)

13. Invitation tokens are single-use and expiring
14. Invitation flow doesn't leak account existence
15. Permission check present on every workspace route (spot-check matrix)
16. GUEST cannot perform mutations
17. Multi-role aggregation correct: a member with ADMIN+GUEST has ADMIN rights
18. Workspace isolation: a member of W1 cannot read W2 data
19. Role management (create/assign/remove/set-permissions) requires ADMIN
20. All SQL parameterized (no string interpolation of user input)

## Regression checks (recorded separately, not points)

After each stage, run the smoke flows of all previous stages
(`smoke/*.sh` with the sequence's endpoint map in `runs/<seq>/smoke.env`).
A stage that breaks an earlier stage's flow = one regression for that
condition. Endpoint maps are filled per sequence after the relevant stage;
the flows and assertions themselves are fixed.
