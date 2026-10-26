---
"@fonderie/customers": patch
---

Mark `@fonderie/workspaces` as a required peer dependency. It was incorrectly declared optional in `peerDependenciesMeta`, but the package statically imports `withWorkspace` and `getWorkspaceSettings` from it (and every route is workspace-scoped), so `@fonderie/customers` failed at module load when workspaces was not installed. No behavior change for any working installation — a consumer without workspaces was already broken.
