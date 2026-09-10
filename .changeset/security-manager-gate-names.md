---
"@fonderie/workspaces": patch
"@fonderie/billing": patch
---

Manager gates match role NAMES, not just `is_system` (closes a hole in the just-shipped RBAC gates). Both `ADMIN` and `GUEST` are seeded system roles, and every default invitation lands on `GUEST` — so "holder of any active system role" made every default-invited member a manager, defeating the gate. `requireManager` (workspaces) and `requireBillingManager`/`isWorkspaceManager` (billing) now accept the workspace owner or a holder of an active **system role whose name is in the manager list** — default `['ADMIN']`, configurable via the new `managerRoles` config option in both packages. The `is_system` restriction remains (a member-created local role named 'ADMIN' still grants nothing).
