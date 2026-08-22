---
"@fonderie/react-workspaces": minor
"@fonderie/vue-workspaces": minor
"@fonderie/react-billing": minor
"@fonderie/vue-billing": minor
"@fonderie/react-webhooks": minor
"@fonderie/vue-webhooks": minor
"@fonderie/react-config-admin": minor
"@fonderie/vue-config-admin": minor
"@fonderie/react-courier-admin": minor
"@fonderie/vue-courier-admin": minor
"@fonderie/react-workspaces-screens": minor
"@fonderie/react-native-workspaces-screens": minor
"@fonderie/vue-workspaces-screens": minor
"@fonderie/react-webhooks-screens": minor
"@fonderie/react-native-webhooks-screens": minor
"@fonderie/vue-webhooks-screens": minor
"@fonderie/react-config-admin-screens": minor
"@fonderie/vue-config-admin-screens": minor
"@fonderie/react-courier-admin-screens": minor
"@fonderie/vue-courier-admin-screens": minor
---

**Breaking (0.x minor):** the 15 hooks deprecated in the refresh-policy release are removed. Their behavior lives on the list hooks, which self-refresh after writes: `useMembers().removeMember`, `useRoles().updateRole`, `useRolePermissions(roleId).setRolePermissions`, `useWorkspaces().createWorkspace`/`.acceptInvitation`, `usePlans()` admin writes, `useUsage(metric).recordUsage`, `useWebhookDeliveries(endpointId).testEndpoint`, and the config/secret/template save+delete on `useConfigEntries`/`useSecrets`/`useTemplates`. New: `useWebhookEndpoints().testEndpoint(endpointId)` for list-context test-sends (refreshes nothing — a test delivery doesn't change the endpoint list). All pre-built screens are migrated; vue `useTemplates` locale params corrected to `string | null` to match the client.
