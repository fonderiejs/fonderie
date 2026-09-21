---
'@fonderie/admin': minor
---

`GET /_admin/config`, `/_admin/routes` and `/_admin/access/tokens` — the rest of Tier 0

- **config**: readiness problems per module, and the *presence* of each
  environment variable the deployment reads — never the value. Bricks never
  read `process.env` (config is injected), so the app names them:
  `AdminModule({ env: [...] })`.
- **routes**: every route with a guard class — `admin`, `probe`, or `app`.
  Whether an `app` route needs a session is not derivable here, so it is not
  claimed.
- **access/tokens**: the admin token's readiness verdict, and which bricks
  still register a legacy standalone surface with their own token.

Phase 6 of `docs/ADMIN-BRICK-DESIGN.md`.
