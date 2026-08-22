---
"@fonderie/vue-auth": minor
"@fonderie/vue-billing": minor
"@fonderie/vue-workspaces": minor
"@fonderie/vue-customers": minor
"@fonderie/vue-audit": minor
"@fonderie/vue-webhooks": minor
---

Vue composables now match the React hooks' reactive contract: data parameters accept MaybeRefOrGetter and refetch on change; initial fetches run in onMounted (SSR-safe); every composable exports its IUse*Return interface.
