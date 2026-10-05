---
'@fonderie/workspaces': minor
'@fonderie/webhooks': minor
'@fonderie/billing': minor
'@fonderie/audit': minor
---

The owner hears when someone else adds a webhook or cancels the plan, and the audit trail can be limited to the people allowed to read it (docs/INSIDER-THREAT-DESIGN.md, Phase 6).

Adding a webhook (a live copy of every event of the business) or cancelling the plan happened outside the team brick. Nothing recorded who did it, and the owner was not told. Any member could read the whole audit trail, including who removed whom.

- **`@fonderie/webhooks`:** after a successful change, emits `fonderie.webhook.endpoint.created`, `.updated`, `.deleted` or `.restored` with `{ workspaceId, userId, endpointId, host }`. Only the URL's host is recorded, never its path or query (which may carry a token), and never the secret. Exported as `WEBHOOK_EVENTS`.
- **`@fonderie/billing`:** after a successful cancel, emits `fonderie.billing.subscription.cancel_requested` with `{ workspaceId?, subscriberType, subscriberId, userId, atPeriodEnd }`.
- **`@fonderie/workspaces`:** emails the owner when someone else creates a webhook (`workspace-webhook-created-alert`, naming the host) or cancels a team's plan (`workspace-plan-cancel-alert`, saying whether it ends now or at period end), in 5 languages. The owner's own moves and personal plans send nothing. `OWNER_ALERT_EVENTS` lists the events it listens to.
- **`@fonderie/audit`:** `new AuditModule(store, { permission: 'audit' })` makes reading the trail require `read` on that permission through `@fonderie/permissions`. It refuses when that module is missing. Unset, nothing changes.
