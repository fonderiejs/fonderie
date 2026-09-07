---
'@fonderie/client': minor
'@fonderie/react-billing': minor
---

Expose the in-app payment-method flow (billing server 8.7.0) through the SDK so a card can be added/replaced/removed without leaving the site:

- `@fonderie/client` `BillingClient`: `setupPaymentMethod()` → `{ clientSecret }` (SetupIntent for the embedded card element), `savePaymentMethod({ paymentMethodId })` → the saved card, `removePaymentMethod()`.
- `@fonderie/react-billing`: `useSetupPaymentMethod` (resolves the SetupIntent client secret for the Payment Element), `useSavePaymentMethod`, `useRemovePaymentMethod` — same context/explicit-client shape as the other billing hooks. `@fonderie/react-native-billing` re-exports them.
