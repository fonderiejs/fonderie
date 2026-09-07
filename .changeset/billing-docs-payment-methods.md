---
'@fonderie/billing': patch
'@fonderie/react-billing': patch
'@fonderie/vue-billing': patch
'@fonderie/react-native-billing': patch
'@fonderie/react-billing-screens': patch
'@fonderie/vue-billing-screens': patch
'@fonderie/react-native-billing-screens': patch
---

Documentation: cover in-app payment-method management. The `@fonderie/billing` README gains a *Payment methods* section (routes, the on-page SetupIntent flow, the optional provider methods with their `501` fallback, ownership checks, and `allow_redirects: 'never'`); the hook/composable READMEs list `usePaymentMethod`/`useSetupPaymentMethod`/`useSavePaymentMethod`/`useRemovePaymentMethod` with a short in-app example; and the screens READMEs document `SubscriptionScreen`'s payment-method section and its add/update delegation (`onAddPaymentMethod` prop / `add-payment-method` emit). Docs-only — no runtime change.
