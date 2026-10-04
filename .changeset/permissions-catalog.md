---
'@fonderie/permissions': minor
'@fonderie/workspaces': minor
'@fonderie/customers': minor
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
---

Permissions work end to end, from one declared list to the button a member sees.

- **One catalog**: `new PermissionsModule(store, { catalog: [{ key: 'jobs' }, { key: 'reports', operations: ['read'] }] })`. A role editor reads it (`GET /workspaces/permissions/catalog`, `usePermissionCatalog`). Saving a role refuses a key outside it (`422 UNKNOWN_PERMISSION`) or an operation the resource does not have (`422 UNSUPPORTED_OPERATION`), so no switch can promise a restriction the server never checks.
- **Rights for the built-in roles, from config**: `systemGrants: { GUEST: { jobs: ['read'] } }`. The system roles are shared by every workspace, so their rights are read from config at check time: every workspace, existing ones included, has them at once, with no seeding or backfill. A workspace's own role named `GUEST` gets none of them. A `systemGrants` key missing from the catalog stops the app at boot.
- **What may I do here?** `GET /workspaces/current/permissions` returns `isOwner`, `isManager`, `isSuper` and per-resource rights (the union across all the member's roles). `usePermissions()` / `useCan(op, resource)` in React, React Native and Vue answer **no until the server has answered**, and re-read on a workspace switch and after any workspace write (a role change).
- **Customers obey permissions**: `new CustomersModule(store, { permission: 'customers' })`. Reads need `read`; creating a customer `create`; deleting one `delete`; every other write (emails, notes, tags, blacklist…) `update`. Unset: unchanged.
- **Deleting a role** now also removes its assignments and grants (before, they were left pointing at nothing). Anyone for whom it was the only role stays on the team with the default role, and the response (and `useRoles().removeRole`) says `{ membersAffected, movedToDefaultRole }`.
- Hooks taking an id (`useRole`, `useRolePermissions`, `useMemberRoles`, `useWorkspace`) wait instead of requesting with an empty one.
