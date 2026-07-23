# Phase-1 oracle re-run — against the published, fixed packages

Re-ran the contract oracle against a backend built on the **published** SDK
(post-release: `onResponse` config, the cookie fix) with the "adopter" additions
a real app would write: an `onResponse` that flattens Fonderie's envelope to
crewfinding's flat shapes, and a thin path-alias shim. Measures how far the
shipped fixes closed the Phase-1 gap.

## Result: 25 / 25 — GREEN (was 6 / 25 vanilla)

Two stages, both against the **published** SDK:
1. **SDK config alone (`onResponse` + the cookie fix): 18 / 25.** Every
   path-matching endpoint (register/login/refresh/logout) went fully green —
   flat `{user,accessToken,refreshToken}`, `IUserDTO`, and `access_token`/
   `refresh_token` **HttpOnly cookies now arrive**. Those were the two biggest
   Phase-1 divergences, closed with one config option and zero handler edits.
2. **+ a ~15-line contract shim → 25 / 25.** The residual was pure route-naming;
   a thin express middleware rewriting crewfinding's paths (and one method) to
   Fonderie's closes it completely.

| endpoint | vanilla | final |
|---|---|---|
| register, login, refresh | ✗ | ✓ flat shape + `IUserDTO` + **cookies** |
| logout, forgot | ✗ | ✓ `{ ok: true }` |
| reset, verify (contract shape) | ✗ | ✓ |
| GET /users/me → `GET /users` | ✗ | ✓ (path alias) |
| PATCH /users/me → `PUT /users/profile` | ✗ | ✓ (method+path alias) |
| workspaces | skip | skip |

**The complete adopter integration** (in `backend/`):
- **`onResponse`** — flatten Fonderie's `{reason,explanation,result}` envelope to
  crewfinding's shapes, incl. mapping the user (`result.user` → flat `IUserDTO`,
  `profileImageUrl`→`avatarUrl`). *SDK config, no handler edits.*
- **path/method shim** — ~15 lines of express middleware:
  `/users/me`→`/users`, `PATCH /users/me`→`PUT /users/profile`,
  `/auth/forgot-password`→`/auth/email/forgot`, etc.
- **cookies** — automatic (SDK fix #55/#56).

**Verdict: Outcome A is achievable.** An existing frontend works **unchanged**
against a Fonderie-rebuilt backend with (a) one SDK config option and (b) a thin,
app-owned contract shim — no fork of the SDK, no frontend edits. The Phase-1
"needs a full adapter" gap is now "needs a config callback + ~15 lines."

### Two bugs this closure surfaced
- The 18→25 gap was initially masked by a **`docker cp` nesting mistake** (the
  shim `index.ts` landed in `/app/src/src/`, so the container ran an alias-less
  build) — a harness error, not a code one; the shim logic was always correct.
- `updateProfile`/`me` nest the user under `result.user`; the `onResponse`
  mapper had to read `r.user ?? r` (one-line fix).

## 🚨 Release defect found (more important than the score)

The re-run could not install the published packages cleanly. Root cause:

- **`events@2.0.0` and `customers@2.0.0` shipped wrong peer ranges** —
  `@fonderie/core@^1.0.0` / `store@^1.0.0`, but those are `0.2.0` / `0.1.2` →
  `npm install` fails with `ERESOLVE`.
- **`events@2.0.0`'s tarball is missing its migration SQL** (`dist/migrations/sql`
  absent) → won't boot.

Cause: both were published from an **earlier partial release** built when
`core`/`store` were assumed to be `1.0.0`; they were never rebuilt, and moving
`latest` onto them (the dist-tag repair) exposed the bad builds. The **current
source is correct** (`core@^0.2.0`, `store@^0.1.1`) and a fresh build ships the
SQL. Fix: republish both as **2.0.1** (changeset `republish-events-customers`).

## Honest caveats
- After the events/customers `2.0.1` republish, a clean install *still* needs
  `--legacy-peer-deps` because **`@fonderie/rate-limit@1.0.0` has the same broken
  peer ranges** (`core@^1.0.0`) — a third stale build from the partial release
  that the first fix missed. The republished events `2.0.1` ships its SQL cleanly
  (no hand-copy needed). rate-limit needs the same `1.0.1` republish.
- Ran fully in-docker (host↔container networking is broken in this environment),
  so it's a faithful *contract* run, still a proxy for the live frontend.
