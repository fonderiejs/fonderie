---
'@fonderie/vue-billing': minor
---

Add `useSetupPaymentMethod`, `useSavePaymentMethod`, and `useRemovePaymentMethod` composables — Vue parity for the in-app payment-method hooks shipped in `@fonderie/react-billing`. Same three-step, never-leave-the-site flow: `setup()` returns the provider SetupIntent client secret for an embedded card element to confirm, `save(paymentMethodId)` records the confirmed card as the default and resolves to it for display, and `remove()` detaches it. Each follows the established composable shape (`isLoading`/`error` refs, `FonderieApiError` normalization, client resolved from `FonderiePlugin`).
