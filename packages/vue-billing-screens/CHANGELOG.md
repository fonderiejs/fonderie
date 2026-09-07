# @fonderie/vue-billing-screens

## 0.3.0

### Minor Changes

- 8a5c84a: `SubscriptionScreen` now surfaces the payment method on file. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via the new `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires the Stripe Payment Element — publishable key + `<Elements>` — which is host-app-owned, so the screen delegates it upward through a new `add-payment-method` emit (the same pattern `manage-billing` already uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its embedded card form. Provider-agnostic: the screen still takes no Stripe dependency.

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/vue-billing@0.2.0
