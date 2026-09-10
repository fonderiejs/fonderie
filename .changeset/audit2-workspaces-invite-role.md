---
"@fonderie/workspaces": patch
---

Validate the invitation `roleId` like a direct role assignment. An explicit `roleId` on `POST /workspaces/invitations` flowed unvalidated into the membership INSERT on accept — bypassing `addRoleToMember`'s workspace-local + non-system rule, so a manager could grant the system ADMIN role or another workspace's role via invitation (foreign role names then satisfied name-based role checks). Explicit role ids must now be a non-system role of the inviting workspace (`422 INVALID_ROLE` otherwise); the least-privilege system GUEST default is unchanged.
