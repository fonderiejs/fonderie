---
"@fonderie/client": minor
"@fonderie/react-workspaces": minor
"@fonderie/react-billing": minor
"@fonderie/react-audit": minor
"@fonderie/react-webhooks": minor
"@fonderie/react-customers": minor
"@fonderie/react-auth": minor
"@fonderie/react-native-auth": minor
"@fonderie/react-config-admin": minor
"@fonderie/react-courier-admin": minor
"@fonderie/vue-workspaces": minor
"@fonderie/vue-billing": minor
"@fonderie/vue-audit": minor
"@fonderie/vue-webhooks": minor
"@fonderie/vue-customers": minor
"@fonderie/vue-auth": minor
"@fonderie/vue-config-admin": minor
"@fonderie/vue-courier-admin": minor
---

Phase 3 of the hook-gap audit: one refresh policy everywhere.

**Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.

**Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.
