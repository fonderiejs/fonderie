# @fonderie/react-billing-screens

## 0.3.1

### Patch Changes

- 113c586: Documentation: cover in-app payment-method management. The `@fonderie/billing` README gains a *Payment methods* section (routes, the on-page SetupIntent flow, the optional provider methods with their `501` fallback, ownership checks, and `allow_redirects: 'never'`); the hook/composable READMEs list `usePaymentMethod`/`useSetupPaymentMethod`/`useSavePaymentMethod`/`useRemovePaymentMethod` with a short in-app example; and the screens READMEs document `SubscriptionScreen`'s payment-method section and its add/update delegation (`onAddPaymentMethod` prop / `add-payment-method` emit). Docs-only — no runtime change.
- Updated dependencies [113c586]
  - @fonderie/react-billing@0.7.1

## 0.3.0

### Minor Changes

- 1af9e5b: `SubscriptionScreen` now surfaces the payment method on file — mirroring `@fonderie/vue-billing-screens`. It reads the saved card via `usePaymentMethod` (brand •••• last4 · expiry, or "No card on file") and removes it via `useRemovePaymentMethod`, refreshing the display on success. Adding or replacing a card requires the Stripe Payment Element (publishable key + `<Elements>`), which is host-app-owned, so the screen delegates it through a new optional `onAddPaymentMethod` prop (the same pattern `onManageBilling` uses for the portal URL); the host wires `useSetupPaymentMethod`/`useSavePaymentMethod` to its embedded card form. Provider-agnostic: the screen still takes no Stripe dependency.

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.

### Patch Changes

- Updated dependencies [f6f54a2]
  - @fonderie/react-billing@0.2.0
