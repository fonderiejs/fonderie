# Phase 4.1 quality checklists — one per session, scored by hand

The decision rule requires **equal quality** — a cheaper condition that ships
worse code is not a win. Each of the 4 workload sessions has its own pass/fail
rubric below, ASVS-anchored where a control applies. Score the final `src/`
tree of each run and record it with `score.mjs` (writes `checklist_pass` /
`checklist_total` into that session's `meta.json`; `analyze.mjs` reads them).

**Quality floor (per session):** `pass ≥ total − 1` — the multi-session
generalization of the pre-registered "≥ 11/12". A condition-session below its
floor is disqualified from the cost comparison for that cell (a cheap run that
skipped the work isn't cheaper, it's incomplete).

**Delegation counts — when wired.** In `fat`/`pb`, items satisfied by delegating
to an audited `@fonderie/*` brick pass *only if the module is actually
registered + mounted*, not merely installed. That delegation is the product
thesis; crediting it is correct, but it must be real.

---

## Session 1 — Auth (12) · prompt: sign up + log in
*Identical to `token-cost-2026-07/CHECKLIST.md` (ASVS-mapped there).*

1. Strong password hash (bcrypt/argon2/scrypt), never plaintext/fast-hash — ASVS 2.4.1
2. Session/JWT signed with a strong secret — 3.2.1
3. Secret from env, **no** insecure hardcoded fallback — 2.10.4
4. Sign-up endpoint persists a user — functional
5. Login endpoint verifies credentials, issues a session — functional
6. Logout / session invalidation path — 3.3.1
7. Input validation on auth payloads — 5.1.3
8. Credentials never logged or returned — 7.1.1
9. Brute-force / rate limit on login — 2.2.1
10. Parameterized DB access — 5.3.4
11. `tsc --noEmit` clean — build gate
12. Password policy (min length/strength) — 2.1.1

## Session 2 — Billing + plan-gate (9) · prompt: monthly subscription, lock premium behind paid
1. Subscription/checkout flow exists and creates a provider subscription — functional
2. Webhook endpoint **verifies the provider signature** (never trusts the client body) — 13.x integrity
3. Webhook route registered **before** global auth middleware (Fonderie `webhook-route-before-auth-mw`) — else signed callbacks 401
4. Premium feature gated **server-side** for non-subscribers (not just hidden in UI) — 4.1.1
5. Subscription state persisted server-side, not derived from a client claim — 4.1.2
6. Webhook handling idempotent (a ret/replayed event doesn't double-provision)
7. Provider secret key from env, not hardcoded — 2.10.4
8. Parameterized DB access — 5.3.4
9. `tsc --noEmit` clean

## Session 3 — Teams + email invites (9) · prompt: create team, invite by email, accept/reject, list
1. Create workspace/team endpoint — functional
2. Invitation token single-use **and** expiring — 2.2.1 / functional
3. Invite flow doesn't leak account existence — 2.2.1
4. Accept **and** reject invitation paths — functional
5. List a workspace's members — functional
6. Only members/admins can invite or list (authorization enforced, not open) — 4.1.1
7. Invitation email actually sent/queued via a mailer (courier wired), not a TODO — functional
8. Parameterized DB access — 5.3.4
9. `tsc --noEmit` clean

## Session 4 — Security pass (9) · prompt: rate-limit reset/invites + audit log
1. Rate limit enforced on the password-reset endpoint — 2.2.1
2. Rate limit enforced on invitation acceptance — 2.2.1
3. Audit log records **login** — 7.1.1
4. Audit log records **logout** — 7.1.1
5. Audit log records **password reset** — 7.1.1
6. Audit log records **role grant/removal** — 7.1.1
7. Audit entries append-only + workspace-scoped (not editable, not global) — 7.2.1
8. No regression — earlier sessions' smoke flows still pass
9. `tsc --noEmit` clean

---

## Scoring procedure (R4 discipline)

- Score at **run time**, inspecting the produced `src/`, not reconstructed later.
- Record with: `node score.mjs <run-id> <pass>/<total> ["notes"]`
  (e.g. `node score.mjs pb-1-s2 8/9 "webhook not idempotent"`).
- Scores append to `SCORES.md` (audit trail) and land in `meta.json` so
  `analyze.mjs` can enforce the floor. Anyone can re-inspect a run's tree and
  re-score — that's the external-checkability the credibility gate wants.
