---
'@fonderie/react-billing-screens': minor
---

`SubscriptionScreen` now surfaces the payment method on file — mirroring `@fonderie/vue-billing-screens`. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires the Stripe Payment Element (publishable key + `<Elements>`), which is host-app-owned, so the screen delegates it through a new optional `onAddPaymentMethod` prop (the same pattern `onManageBilling` uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its embedded card form. Provider-agnostic: the screen still takes no Stripe dependency.
