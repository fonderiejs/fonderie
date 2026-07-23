# Phase 1 results — vanilla Fonderie backend vs the crewfinding contract

Built a Fonderie backend (`backend/`) with auth + workspaces, booted it, and ran
the contract oracle against it. The point of Phase 1: **measure the raw gap**
between Fonderie's default contract and the one crewfinding's frontend expects.

## It boots on Fonderie
auth + billing + workspaces compose on `FonderieApp`; all migrations self-apply
on boot; the server serves requests. The db-free-authoring premise held (once the
environment allowed a DB at all — see Infra caveat).

## Finding 1 — a mandatory coupling: workspaces → billing → Stripe
`@fonderie/workspaces` declares `deps = ['@fonderie/auth', '@fonderie/billing']`
(workspaces carry a `plan`). `@fonderie/billing`'s config requires a live
`IBillingProvider` (`new StripeProvider(secretKey)`). So **a field-service app
that only reads/updates a workspace must still wire billing and a Stripe
provider.** That's a real coupling/maturity gap — reading a workspace shouldn't
require a payments dependency. (Minor: `getMigrationsPath` resolves under ESM
`import` but not CJS `require.resolve` — inconsistent but not blocking.)

## Finding 2 — the raw contract gap: 6 / 25 assertions pass
| # | Endpoint | HTTP | Path match | Shape/cookies |
|---|---|---|---|---|
| 1 | POST /auth/register | 201 | ✅ | ❌ envelope |
| 2 | POST /auth/login | 200 | ✅ | ❌ envelope |
| 3 | GET /users/me | 404 | ❌ (Fonderie: `GET /users`) | — |
| 4 | PATCH /users/me | 404 | ❌ | — |
| 5 | POST /auth/refresh | 4xx | ✅ path | ❌ envelope/body |
| 6 | POST /auth/forgot-password | 404 | ❌ (`/auth/email/forgot`) | — |
| 7 | POST /auth/reset-password | 404 | ❌ (`/auth/email/reset`) | — |
| 8 | POST /auth/verify-email | 404 | ❌ (`/auth/verify`) | — |
| 9 | POST /auth/logout | 401 | ✅ path | needs token (envelope) |
| 10 | GET /workspaces/:id | ✅ path | ✅ | needs token + workspace_id |
| 11 | PUT /workspaces/:id | ❌ (Fonderie: `PUT /workspaces` + header) | — | — |

Three concrete divergences:

1. **Response envelope.** Fonderie returns
   `{ reason, explanation, result: { tokens: { access, refresh }, user } }`;
   crewfinding expects flat `{ user, accessToken, refreshToken }`. This breaks
   every shape assertion *and* token capture (tokens are nested under `result`).
2. **Paths.** `/auth/forgot-password → /auth/email/forgot`, `/auth/reset-password
   → /auth/email/reset`, `/auth/verify-email → /auth/verify`, `/users/me →
   /users`, `PUT /workspaces/:id → PUT /workspaces` (workspace id via header).
3. **Cookies.** crewfinding expects `access_token` / `refresh_token` HttpOnly
   cookies; Fonderie sets neither (tokens live only in the JSON `result.tokens`).

## Verdict (tendency): Outcome B — needs a contract adapter
Vanilla Fonderie is **far** from crewfinding's contract. Matching it needs:
- a **response-envelope transformer** (unwrap `result`, flatten tokens, map the
  Fonderie user → flat `IUserDTO`, e.g. `profileImageUrl → avatarUrl`),
- **route aliases** for ~5 divergent paths,
- a **cookie setter** for `access_token` / `refresh_token`.

That is achievable but real work — so adopting Fonderie under an existing frontend
means **"Fonderie + an adapter shim," not "drop-in."** Not Outcome A (drop-in),
not Outcome C (impossible). Phase 2 builds that adapter and re-measures how close
to green it gets; the residual is the honest adoption cost.

## Infra caveat (why this ran the way it did)
This environment's Docker was degraded: host↔container **port-forwarding was
broken** (host couldn't reach any published port) and **bind mounts didn't expose
host files**. So the backend + newman were run **entirely inside a container** on
a private docker network (`docker cp` the source in, Postgres reachable by DNS).
That's a faithful *contract* run; it is still a proxy for "the real frontend works"
(the `platform/*` submodules aren't in this environment). The oracle and backend
are portable — re-run where the real app lives for the live-frontend proof.
