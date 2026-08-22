---
"@fonderie/react-workspaces": minor
"@fonderie/vue-workspaces": minor
---

The last two audit read gaps: `useWorkspace(workspaceId)` and `useRole(roleId)` — read hooks with `refresh({force})` for the explicit-id lookups (`getWorkspace`/`getRole`) that previously had no hook. Current-workspace mutations stay in `useWorkspaceProfile` (they act on the client's workspace scope, not an explicit id). Vue versions take `MaybeRefOrGetter` params and refetch on change. The hook-coverage CI gate's allow-list entries for both methods are removed — they're now enforced as covered.
