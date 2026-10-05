---
'@fonderie/audit': patch
---

`GET /audit` now resolves the caller's workspace itself.

The route only read `ctx.workspace`, which nothing set. In an app without its own workspace middleware, every request answered `422 MISSING_WORKSPACE`, so the activity log could not be read at all.

The route now runs `@fonderie/workspaces`' `withWorkspace`, which reads `X-Workspace-ID` and verifies membership, so a non-member is refused. A workspace that an app middleware already set is used as is. `@fonderie/workspaces` 7.2+ is now a peer dependency.
