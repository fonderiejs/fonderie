---
'@fonderie/workspaces': patch
---

Workspace, member, and invitation timestamps serialize as ISO strings again

In production the pg driver returns TIMESTAMPTZ columns as Date objects, and
`toWorkspaceDTO`/`toMemberDTO`/`toInvitationDTO` mapped every timestamp
through `stringOrEmpty` — which returns `''` for anything that isn't already
a string. So `createdAt`/`updatedAt`/`archivedAt` on workspaces, the member
join date, and — most visibly — the invitation `expiresAt` a UI needs to
show invite expiry, all serialized as empty strings, while the client types
declare real strings. (Unit tests missed it because their stubs fed ISO
strings where pg delivers Dates.)

All six mappings now use core's `dateOrEmpty`, the same convention the
customers package already follows, and new tests feed actual Date objects to
pin the ISO contract. `archivedAt` stays `''` for non-archived workspaces
with `isArchived` derived independently, as before.
