---
'@fonderie/workspaces': minor
---

Deleting an account now erases what workspaces holds about the person. `accountEraser(store)` is what the account purge calls, once the grace period is over, just before the user row goes: it removes every membership of theirs, every invitation sent to their address (any status, including a `+tag` alias of it), their personal workspace, and every workspace they own that nobody else still belongs to — with its roles, role permissions, memberships and invitations. Workspaces that stay forget who archived them.

A workspace they own that still has other members is never deleted under them: it is left in place and the erasure reports it (`kept`), so the operator can see a team still needs a new owner. Running the eraser twice is harmless; the second run erases nothing.
