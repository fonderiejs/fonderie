---
'@fonderie/admin': minor
---

`ui: true` — serve the dashboard from the deployment itself

`AdminModule({ ui: true })` serves `@fonderie/react-admin-screens` at
`GET /_admin/ui`, compiled into one 82 KB-gzipped file that ships in this
package. A deployment gets the whole operator surface with no frontend
build and no new dependency — React and the screens are devDependencies
here, bundled at publish time. Off by default.

The two static routes are unguarded by design: a browser navigating to a
page cannot send an `Authorization` header, and neither file carries data.
The page asks for a token, keeps it in `sessionStorage` for that tab only,
and sends it itself — so every request that reads anything is guarded and
logged exactly as before. It reads the manifest first and builds a client
only for bricks that described routes, so pages that would 404 never
appear. The script path comes from the request, so it is correct under a
`basePath`, a moved `path`, and a trailing slash.

Phase 7c of `docs/ADMIN-BRICK-DESIGN.md`.
