---
'@fonderie/webhooks': major
---

The `/webhooks` routes now resolve the caller's workspace and require a manager.

**The routes worked for nobody.** No route mounted `withWorkspace`, so `ctx.workspace` was always `null` and every route answered `422 MISSING_WORKSPACE`, even with an `X-Workspace-ID` header. The only exception was an app that mounted `withWorkspace` globally itself. Every route now resolves the workspace from `X-Workspace-ID` (falling back to the personal workspace) and verifies membership.

**Any member could manage endpoints.** Once the workspace resolved, the routes checked no role, so any member could create, change or delete an endpoint and read the signing secret returned on create. They now require the workspace owner or a manager role, with the same `management` and `managerRoles` options as `@fonderie/workspaces`. Plain members get `403 MANAGER_REQUIRED`. Pass `{ management: 'any-member' }` to keep open access for flat teams.

**Breaking:**
- `@fonderie/workspaces` (`^6.1.0`) is now a required peer; the module already listed it in `deps`.
- Apps that mounted `withWorkspace` themselves and let members manage webhooks must opt in with `management: 'any-member'` to keep that behaviour.
