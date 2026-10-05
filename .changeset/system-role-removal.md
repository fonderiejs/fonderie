---
'@fonderie/workspaces': patch
'@fonderie/client': patch
---

**Security:** a manager could strip manager rights from every other manager —
and from the owner. `addMemberRole` refuses system roles, but
`DELETE /workspaces/members/:userId/roles/:roleId` did not: give the target any
custom role (so ADMIN is not their last), then delete their ADMIN row. Two
calls, no owner involved, nobody told. System roles (ADMIN, GUEST) are now
refused there with `403 SYSTEM_ROLE`; manager rights come off only through the
owner-only `DELETE /workspaces/members/:userId/manager`.

The removal is also atomic now: the member's role rows are locked for the
check and the delete, so two removals racing on a two-role member can no longer
both pass "more than one role left" and leave them with none. Outcomes have
their own reasons: `ROLE_NOT_HELD` (404), `LAST_ROLE` (400), `SYSTEM_ROLE` (403),
translated in the client's error dictionaries.
