---
"@fonderie/workspaces": minor
---

Add `routes` to `IWorkspacesConfig` — override any workspace route's path (and optionally method) by a stable id, matching `@fonderie/auth`'s `routes` config. This closes the last crewfinding contract divergence: a frontend that does `PUT /workspaces/:id` (id in the path) maps onto Fonderie's header-based update with a single line — `routes: { updateWorkspace: '/workspaces/:id' }` — because `wsCtx` already resolves the workspace from the `:id` path param first. No param-extraction shim needed. A bare string overrides the path; an object can also change the method; unset routes keep defaults.
