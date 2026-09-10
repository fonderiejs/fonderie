---
"@fonderie/workspaces": patch
---

Re-validate the invitation role at ACCEPT time (defense-in-depth). The `roleId` is validated when the invitation is created, but accept now re-confirms it is still assignable — a workspace-local non-system role, or the seeded least-privilege system GUEST default — so a role that has since become non-assignable (or a directly-written bad row) can never grant a privileged membership. A system ADMIN or a foreign workspace's role is refused.
