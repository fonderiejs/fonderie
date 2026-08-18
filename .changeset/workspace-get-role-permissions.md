---
"@fonderie/workspaces": minor
"@fonderie/client": minor
---

feat(workspaces): add GET /workspaces/roles/:roleId/permissions

Roles could only have permissions *set* (POST) — there was no way to *read* a
role's permissions. Adds the missing read endpoint:

- `@fonderie/workspaces`: `getRolePermissions` service + `RoleModel.getPermissions`
  + `role.getPermissions` controller, registered as
  `GET /workspaces/roles/:roleId/permissions` (requireAuth, workspace-scoped).
- `@fonderie/client`: `workspaces.getRolePermissions(roleId)` returning
  `{ permissions: IRolePermission[] }`.
