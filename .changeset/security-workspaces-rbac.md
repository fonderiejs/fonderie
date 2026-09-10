---
"@fonderie/workspaces": patch
---

Close two workspace role vulnerabilities. (1) Privilege escalation via role assignment: `POST /workspaces/members/:userId/roles` accepted any role id, so a member could self-grant the seeded system `ADMIN` role (super-role bypass) or a role id from another workspace. Assignment now only succeeds for a role that belongs to the caller's workspace and is not a system role, and returns `422 INVALID_ROLE` otherwise. (2) Cross-workspace role IDOR: reading and mutating a role by id (`getRoleById` / `updateRole`, and the `getRole` / `updateRole` / `getRolePermissions` / `setRolePermissions` routes) were not workspace-scoped, letting a member of one workspace read or rename/deactivate another workspace's roles. All role lookups and mutations are now scoped to `workspace_id` (or a global system role for reads).
