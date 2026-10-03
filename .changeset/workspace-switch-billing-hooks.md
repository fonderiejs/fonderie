---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/react-billing': minor
'@fonderie/vue-billing': minor
---

**Billing screens follow a workspace switch.** With workspace billing the subscriber is the selected workspace, but the billing hooks only loaded on mount — a screen that stayed open across a switch kept showing the previous workspace's subscription, card, invoices or wallet.

- `@fonderie/client`: `client.getWorkspaceId()` and `client.onWorkspaceChange(listener)` (returns an unsubscribe); the billing sub-client has the same pair. Listeners fire only when the id actually changes.
- `@fonderie/react` / `@fonderie/vue`: `useWorkspaceId(source?)` — the current workspace id, re-rendering (React) or as a Ref (Vue) when it changes. Follows the provided client, or the sub-client you pass.
- `@fonderie/react-billing` / `@fonderie/vue-billing`: `useSubscription`, `usePaymentMethod`, `useInvoices`, `useWallet`, `useWalletTransactions`, `useWalletPreferences` and `useUsage` clear what they showed and re-read on a switch, and a slow answer for the previous workspace can no longer land on top of the new one. `usePlans` / `usePlan` are not per-workspace and are unchanged.

`@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.
