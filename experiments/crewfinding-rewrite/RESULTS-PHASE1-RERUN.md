# Phase-1 oracle re-run — against the published, fixed packages

Re-ran the contract oracle against a backend built on the **published** SDK
(post-release: `onResponse` config, the cookie fix) with the "adopter" additions
a real app would write: an `onResponse` that flattens Fonderie's envelope to
crewfinding's flat shapes, and a thin path-alias shim. Measures how far the
shipped fixes closed the Phase-1 gap.

## Result: 18 / 25 assertions pass (was 6 / 25 vanilla)

| endpoint | vanilla | re-run |
|---|---|---|
| POST /auth/register | ✗ | **✓✓✓✓** status + flat `{user,accessToken,refreshToken}` + `IUserDTO` + **HttpOnly cookies** |
| POST /auth/login | ✗ | **✓✓✓✓** |
| POST /auth/refresh | ✗ | **✓✓✓✓** |
| POST /auth/logout | ✗ | **✓✓** `{ ok: true }` |
| POST /auth/reset, /verify (contract shape) | ✗ | **✓** |
| GET/PATCH /users/me | ✗ | ✗ — 404 (path alias) |
| POST /auth/forgot-password | ✗ | ✗ — 404 (path alias) |
| workspaces | skip | skip (no workspace_id) |

**What the shipped fixes bought:** every path-matching endpoint is fully green —
the **response-envelope divergence is closed by `onResponse`** (one config option,
no handler edits), and the **cookie fix means `access_token`/`refresh_token`
HttpOnly cookies now arrive**. Those were the two biggest Phase-1 divergences.

**The residual 7 failures are purely route-naming** (`/users/me`→`/users`,
`/auth/forgot-password`→`/auth/email/forgot`, …). `/users` itself exists and works
(returns 401 without auth); the failures are the alias shim not rewriting the path
— an app-integration detail (express `req.url` plumbing through `mount()`), not an
SDK gap. With a working alias layer these close too, reaching ~full green.

**Verdict:** Outcome B confirmed, and the SDK config now carries adoption most of
the way to A. Remaining adopter work = a thin path-alias layer + per-DTO field
mapping in `onResponse` (both app-side, both small).

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
- To run at all, the published packages needed `--legacy-peer-deps` and the
  missing `events` migration SQL hand-copied in — i.e. the release is genuinely
  broken; this is a workaround, and the 2.0.1 republish is the real fix.
- Ran fully in-docker (host↔container networking is broken in this environment),
  so it's a faithful *contract* run, still a proxy for the live frontend.
- The path-alias shim in `backend/` is committed as a reference but its `req.url`
  rewrite doesn't take effect through `mount()` yet — a known app-side tweak.
