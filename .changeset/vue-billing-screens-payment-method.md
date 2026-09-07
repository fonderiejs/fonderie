---
'@fonderie/vue-billing-screens': minor
---

`SubscriptionScreen` now surfaces the payment method on file. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via the new `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires the Stripe Payment Element — publishable key + `<Elements>` — which is host-app-owned, so the screen delegates it upward through a new `add-payment-method` emit (the same pattern `manage-billing` already uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its embedded card form. Provider-agnostic: the screen still takes no Stripe dependency.
