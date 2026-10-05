---
'@fonderie/workspaces': minor
---

People are told when the team changes around them (docs/INSIDER-THREAT-DESIGN.md, Phase 2).

A rogue manager's work could go unnoticed for days: nobody removed, demoted or handed a team was told. Now these emails go out:

- **Removed member** (`workspace-member-removed`): told they were removed, and by whom.
- **Owner alert** (`workspace-member-removed-alert`): the owner is told when a **manager** removed someone.
- **Former manager** (`workspace-manager-removed`): told they are no longer a manager.
- **New owner** (`workspace-ownership-received`): told they now own the workspace, and who handed it over.

Default copy ships in English, French, Spanish and Simplified and Traditional Chinese. The emails are driven by the Phase 1 trail events through the durable outbox, so they go out only for a change that happened. Names and addresses are read when the email is sent; the trail itself stays ids-only. An account awaiting deletion is not written to.

Turn this off with `teamNotices: false`. Route the four keys in courier like `workspace-invitation`.
