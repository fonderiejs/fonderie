---
"@fonderie/react": minor
"@fonderie/vue": minor
"@fonderie/react-auth": minor
"@fonderie/react-native-auth": minor
"@fonderie/react-billing": minor
"@fonderie/react-workspaces": minor
"@fonderie/react-customers": minor
"@fonderie/react-audit": minor
"@fonderie/react-webhooks": minor
"@fonderie/vue-auth": minor
"@fonderie/vue-billing": minor
"@fonderie/vue-workspaces": minor
"@fonderie/vue-customers": minor
"@fonderie/vue-audit": minor
"@fonderie/vue-webhooks": minor
"@fonderie/react-auth-screens": minor
"@fonderie/react-billing-screens": minor
"@fonderie/react-workspaces-screens": minor
"@fonderie/react-customers-screens": minor
"@fonderie/react-audit-screens": minor
"@fonderie/react-webhooks-screens": minor
"@fonderie/react-native-auth-screens": minor
"@fonderie/react-native-billing-screens": minor
"@fonderie/react-native-workspaces-screens": minor
"@fonderie/react-native-customers-screens": minor
"@fonderie/react-native-audit-screens": minor
"@fonderie/react-native-webhooks-screens": minor
"@fonderie/vue-auth-screens": minor
"@fonderie/vue-billing-screens": minor
"@fonderie/vue-workspaces-screens": minor
"@fonderie/vue-customers-screens": minor
"@fonderie/vue-audit-screens": minor
"@fonderie/vue-webhooks-screens": minor
---

Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.
