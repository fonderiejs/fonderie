---
'@fonderie/react-native-billing-screens': minor
---

`SubscriptionScreen` now surfaces the payment method on file — mirroring `@fonderie/react-billing-screens` and `@fonderie/vue-billing-screens`, completing screen-level parity across all three frameworks. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires a native card-entry surface (a Stripe SDK / payment sheet), which is host-app-owned, so the screen delegates it through a new optional `onAddPaymentMethod` prop (the same pattern `onManageBilling` uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its card form. Provider-agnostic: the screen still takes no payment-SDK dependency.
