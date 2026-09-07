# @fonderie/react-native-billing-screens

## 0.3.0

### Minor Changes

- 79749cc: `SubscriptionScreen` now surfaces the payment method on file — mirroring `@fonderie/react-billing-screens` and `@fonderie/vue-billing-screens`, completing screen-level parity across all three frameworks. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires a native card-entry surface (a Stripe SDK / payment sheet), which is host-app-owned, so the screen delegates it through a new optional `onAddPaymentMethod` prop (the same pattern `onManageBilling` uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its card form. Provider-agnostic: the screen still takes no payment-SDK dependency.

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.
