# crewfinding rewrite — contract test suite (Phase 0)

The executable oracle for `PLAN-CREWFINDING-REWRITE.md`. The shipped
`CrewFinding_API.postman_collection.json` has **zero assertions** — it's a request
set, not a test. This suite encodes the **contract the frontend depends on**
(exact paths, status codes, response shapes, cookies, error shape) from
`fonderie-js/POSTMAN_SDK_PARITY.md`, so `newman run` turns green ONLY when a
backend serves crewfinding's contract.

## What it checks (11 in-scope endpoints; directions excluded)
- **Auth (7):** register/login/refresh return flat `{ user, accessToken, refreshToken }`
  with the full `IUserDTO` and set `access_token` + `refresh_token` HttpOnly cookies;
  logout/forgot return `{ ok: true }`; reset/verify assert the contract shape either
  way (no real emailed token in a headless run).
- **Profile (2):** GET/PATCH `/users/me` return a flat `IUserDTO`; PATCH reflects the change.
- **Workspace (2):** GET/PUT `/workspaces/:id` return `{ workspace: IWorkspaceDTO }`.
  Skipped (green) unless `workspace_id` is set to a workspace the test user owns.

## Run it
```sh
node build-contract-tests.mjs        # regenerate the collection (do not hand-edit)

# against any backend — the current one (baseline) or the Fonderie-rebuilt one:
npx newman run contract-tests.postman_collection.json \
  --env-var base_url=http://localhost:3000 \
  [--env-var workspace_id=<uuid>]
```
Requests are chained: register (unique email) captures the tokens the later
authed calls use.

## How to read the result
- **All green** → the backend serves crewfinding's contract; the frontend would
  work unchanged (Outcome A/B).
- **Failures** → precisely where Fonderie's default contract diverges (paths,
  response envelope, cookies, error shape) — the gap list the rewrite must close,
  or Outcome C if it can't be closed without frontend changes.

## Status / caveat
`platform/*` (the real backend + frontend) are not available in this environment
(stale `.gitmodules` entries, not tracked gitlinks), so a **baseline run against
the current backend hasn't been captured here**. This suite is the portable oracle;
run it where the platform code lives for the true baseline, or against the
Fonderie backend (Phase 1–3) for the contract-fit verdict.
