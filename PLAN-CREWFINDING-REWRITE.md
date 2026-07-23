# Plan: crewfinding backend rewrite on Fonderie (the contract-fit test)

## Goal
Rebuild crewfinding's backend with Claude + Fonderie bricks, **frontend
untouched**, and have it still work. The deliverable isn't the code — it's the
answer to the question that decides "just do it": **can Fonderie serve an
existing app's exact API contract, or does adopting it force a frontend
rewrite?**

## Scope (11 in-scope endpoints)
| Area | Endpoints | Brick |
|---|---|---|
| Authentication | 7 — register, login, logout, forgot/reset password, refresh, verify-email | `@fonderie/auth` |
| User Profile | 2 — GET/PATCH `/users/me` | `@fonderie/auth` (users) |
| Workspace | 2 — GET/PUT `/workspaces/:id` | `@fonderie/workspaces` |
| Directions | 2 | **Out of scope** — external Google proxy |

Contract source of truth: `crewfinding/CrewFinding_API.postman_collection.json`
and `fonderie-js/POSTMAN_SDK_PARITY.md`.

## The central finding this exists to expose
The parity doc marks all 11 ✅ at the *capability* level, but the **contract
differs in ways the frontend depends on** — and "frontend untouched" is exactly
what tests that:

1. **Response envelope** — crewfinding: flat `{ user, accessToken, refreshToken }`.
   Fonderie: `{ reason, explanation, result: { tokens: { access, refresh }, user } }`
   (confirmed live). Different shape.
2. **Route paths** — crewfinding: `/auth/forgot-password`, `/auth/reset-password`,
   `/auth/verify-email`. Fonderie: `/auth/email/forgot`, `/auth/email/reset`,
   `/auth/verify`. Different paths.
3. **Cookies** — frontend expects `access_token` / `refresh_token` HttpOnly, with
   `refresh_token` scoped to `Path=/auth/refresh`. Must confirm Fonderie matches.
4. **Error shape** — crewfinding: `{ error }` or `{ code, message }`. Fonderie:
   `{ reason, explanation, result }`.

So the real question: can Fonderie be *configured/adapted* to serve crewfinding's
exact contract, or does adoption impose Fonderie's contract on the client?

## Approach — three outcomes, ranked
- **A. Fonderie flexes to the contract** (best): `basePath`, route aliases, a
  response/cookie adapter so the bricks emit crewfinding's exact shapes. Cleanest
  "just do it" proof.
- **B. Thin contract-adapter layer** in front of the bricks. Works, but means
  "adopting Fonderie needs a shim" — weaker but honest.
- **C. Contract can't be matched** without frontend changes — the constraint
  *fails*. Most valuable finding if it happens: Fonderie imposes an opinionated
  contract, an adoption barrier to fix before launch.

## Definition of done (pre-registered)
The Postman collection is the frontend's contract made executable. **Success =
`newman run CrewFinding_API.postman_collection.json` passes green against the
Fonderie-rebuilt backend** — same paths, status codes, response shapes, cookies.
No frontend edits, no collection edits. Measured, not asserted. Directions excluded.

## Phases
0. **Capture the contract as a test** — ✅ **done** (`experiments/crewfinding-rewrite/`).
   Two findings changed the shape of the work:
   - **The shipped Postman collection has zero assertions** — a request set, not a
     test. So "newman green" was meaningless as written. Built an executable
     **contract oracle** (`build-contract-tests.mjs` → `contract-tests.postman_collection.json`):
     11 in-scope endpoints with real assertions (status, flat response shapes,
     `IUserDTO`/`IWorkspaceDTO` fields, HttpOnly cookies, error shape) derived from
     `POSTMAN_SDK_PARITY.md`. Validated: it loads in newman and its assertions fire.
   - **`platform/*` are stale `.gitmodules` entries, not tracked gitlinks** — the
     real backend + frontend are NOT in this environment. So a baseline-green
     against the *current* backend can't be captured here, and the live frontend
     can't be run. The oracle is portable: run it where the platform code lives for
     the true baseline, or against the Fonderie backend for the contract-fit verdict.
   - Path mismatch **confirmed** from the collection itself: `/auth/forgot-password`,
     `/auth/reset-password`, `/auth/verify-email` vs Fonderie's `/auth/email/*`.
1. **Stand up the Fonderie backend** — `fonderie add` auth + workspaces, wire,
   boot (db-free authoring — no DB setup to build).
2. **Reconcile the contract** — pursue A, fall back to B, document exactly where
   each brick's default shape had to bend.
3. **Run the suite green** — newman passes unchanged, or a precise list of what
   couldn't match (Outcome C).
4. **Gap report** — contract-fit verdict, what Fonderie had to be told/adapted,
   brick maturity gaps, and whether the stack needs serverless.

## Risks & non-goals
- **Non-goal:** touching the frontend or the Directions proxy.
- **Risk:** `platform/*` submodules are uninitialized locally — Phase 0 needs
  access to the real backend + a running frontend (or the collection + a test DB
  as a proxy).
- **Risk:** first honest test of contract-fit — budget for Outcome C, and treat a
  found gap as success, not failure.
