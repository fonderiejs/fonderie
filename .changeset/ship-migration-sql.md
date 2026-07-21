---
"@fonderie/auth": patch
"@fonderie/billing": patch
"@fonderie/config": patch
"@fonderie/courier": patch
"@fonderie/customers": patch
"@fonderie/events": patch
"@fonderie/permissions": patch
"@fonderie/rate-limit": patch
"@fonderie/webhooks": patch
"@fonderie/workspaces": patch
---

Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration *loader* without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.
