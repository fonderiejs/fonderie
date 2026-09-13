---
'@fonderie/store': minor
---

Add `MigrationRunner.pending()` — which migrations this database has not applied, without applying them.

Migrations run out of band, so a deployment routinely goes live ahead of them. Publishing keeps working, boot succeeds, and the gap only surfaces when some request happens to touch the new column or table. The symptom then looks nothing like the cause: a queue that will not drain, an OAuth callback that hangs, a health route that 500s — each diagnosed separately, none of them saying "you did not run the migration".

That happened twice in one day in this repo, to two different subsystems, after the cause had already been documented. Better error messages did not prevent the second one; a number that can be read *before* anything fails might.

Read-only, and safe to call on the request path. A missing migrations table means nothing has ever been applied, so every file is pending — that is the answer, not an error, which matters because the caller is usually a health route on a fresh deployment.
