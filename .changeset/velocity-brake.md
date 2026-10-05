---
'@fonderie/workspaces': minor
'@fonderie/customers': minor
'@fonderie/webhooks': minor
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
---

Someone deleting too much too fast is paused from deleting until the owner looks (docs/INSIDER-THREAT-DESIGN.md, Phase 5).

A rogue manager, or a script running with their session, could remove the team, delete every role, customer and webhook in a few seconds. The undo bin brings things back, but only after someone notices.

- **What counts:** every successful destructive action by someone who is not the owner is counted: removing a member, deleting a role, cancelling an invitation, deleting a customer or a webhook endpoint.
- **The pause:** at `limit` in `windowMinutes` (default 10 in 10), that person is paused. Every braked route answers `429 MANAGER_PAUSED`. Reading and ordinary work go on; the owner is never braked.
- **Telling the owner:** a pause is recorded as `fonderie.workspace.manager.paused` in the audit trail, and the owner is emailed (`workspace-manager-paused`, in 5 languages).
- **Seeing and releasing:** members carry `paused`. The owner releases with `DELETE /workspaces/members/:userId/brake` (`client.workspaces.releaseBrake`, `useMembers().releaseBrake`), and the count starts over.
- **For other modules:** `velocityBrake(store, kind, options, bus)` is exported for their own destructive routes. Configure it with `velocityBrake: { limit, windowMinutes }`, or turn it off with `false`, in workspaces, customers and webhooks.
- **Migration:** apply workspaces `008_velocity_brake`. Customers and webhooks now need `@fonderie/workspaces` 7.1.
