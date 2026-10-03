---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
'@fonderie/react-billing': patch
'@fonderie/vue-billing': patch
---

**Workspace screens open on their data, and follow a workspace switch.** `useMembers`, `useRoles`, `useInvitations`, `useWorkspaceSettings` and the other workspace reads loaded once on mount and never again. After the user switched workspace they kept showing the previous workspace's members and roles, and every visit opened on a spinner. They now read through the client's shared store (`client.queries`), like the billing hooks: data on the first frame when it was seen before, refreshes behind the data, no redraw when the answer is unchanged, and a workspace switch reads the other workspace's entry (instantly when seen before) without ever showing the previous one. Return shapes are unchanged.

- `@fonderie/client`: the `workspaces`, `customers`, `audit` and `webhooks` sub-clients now report their scope, `getWorkspaceId()` and `onWorkspaceChange(listener)`, as `billing` already did. They held the workspace id silently, so no hook could follow a switch. Instances built without the constructor (test doubles) still work.
- `@fonderie/react` / `@fonderie/vue`: `useScopedQuery(source, path, read, { normal, perWorkspace })`, the one read every hook package makes (keyed by path and, for per-workspace data, the selected workspace), plus `useWrite(after)` for the write → re-read → keep-the-error pattern, and `toApiError`.
- `refresh({ force })` keeps its documented meaning in every migrated hook: it always re-reads, and `force: true` also bypasses the HTTP response cache. The billing hooks released in the previous version bypassed it on every `refresh()`; that is restored too.
