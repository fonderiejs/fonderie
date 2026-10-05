---
'@fonderie/workspaces': minor
---

A rogue manager can no longer purge the other managers or lock the team out, and every team change now says who did it (docs/INSIDER-THREAT-DESIGN.md, Phase 1).

A workspace run by several managers had no defence against one of them turning: any manager could remove every other manager, and archive the whole workspace, and nothing recorded who did it. The audit trail could not answer "who removed whom", because team changes emitted no events at all.

- **Managers are peers.** `DELETE /workspaces/members/:userId` refuses a manager unless the owner is asking: `403 MANAGER_PROTECTED`. The check runs under the workspace lock. A manager still removes plain members and can still leave.
- **Archiving is owner-only.** `POST /workspaces/archive` locks every member out, so it now needs the owner (`403 OWNER_REQUIRED`). Restore stays a manager action.
- **The trail.** Every successful team, role, invitation, settings and workspace change emits `fonderie.workspace.*` (`member.removed`, `member.left`, `member.role.added|removed`, `manager.set|unset`, `ownership.transferred`, `invitation.created|cancelled|resent|accepted`, `role.created|updated|deleted|permissions.set`, `created`, `updated`, `archived`, `restored`, `settings.updated`) with `{ workspaceId, userId: <actor>, targetUserId?, roleId?, inviteId(s)? }`. Payloads carry ids only, so the trail holds no personal data and survives account erasure, including the actor's own. A refused request emits nothing. `@fonderie/audit` lists these per workspace and filters by actor.
