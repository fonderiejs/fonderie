---
'@fonderie/workspaces': patch
'@fonderie/client': patch
---

**`workspace.plan` is marked deprecated.** The field is set to `'free'` when a workspace is created and nothing ever updates it — not a subscription, an upgrade or a cancellation — so an app reading it shows "free" for a paying workspace. It is now documented as such; read the workspace's subscription from `@fonderie/billing` (`GET /billing/subscription` with `X-Workspace-ID`, `useSubscription()` in the frontend packages). No behaviour change.
