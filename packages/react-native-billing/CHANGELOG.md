# @fonderie/react-native-billing

## 0.2.2

### Patch Changes

- 158555a: Add the in-app pack-purchase surface for `@fonderie/billing`'s `POST /billing/wallet/purchase`.
  
  - `@fonderie/client`: `billing.purchaseWalletPack({ packId, idempotencyKey })` → `IWalletPurchaseResult` (`status`: `credited` / `checkout_required` / `declined` / `processing`).
  - `@fonderie/react-billing` + `@fonderie/vue-billing`: `usePurchasePack` — charges the saved card, generates one idempotency key per attempt and retries an indeterminate `processing` in place with the SAME key (so a retry can't double-charge), and resolves to the outcome so the caller can fall back to hosted checkout on `checkout_required`. `@fonderie/react-native-billing` re-exports it.
  
  Buy a credit pack without leaving the site when a card is on file; fall back to hosted checkout only when there's no saved card or the card needs 3-D Secure.
- Updated dependencies [158555a]
  - @fonderie/client@0.15.0
  - @fonderie/react-billing@0.8.0

## 0.2.1

### Patch Changes

- 113c586: Documentation: cover in-app payment-method management. The `@fonderie/billing` README gains a *Payment methods* section (routes, the on-page SetupIntent flow, the optional provider methods with their `501` fallback, ownership checks, and `allow_redirects: 'never'`); the hook/composable READMEs list `usePaymentMethod`/`useSetupPaymentMethod`/`useSavePaymentMethod`/`useRemovePaymentMethod` with a short in-app example; and the screens READMEs document `SubscriptionScreen`'s payment-method section and its add/update delegation (`onAddPaymentMethod` prop / `add-payment-method` emit). Docs-only — no runtime change.
- Updated dependencies [113c586]
  - @fonderie/react-billing@0.7.1

## 0.2.0

### Minor Changes

- 4e3991f: Phase 5b: spend-purchased toggle — end-to-end API + hooks
  
  The Phase 5a spend-purchased preference (whether a debit may draw down purchased credits once the free allowance is exhausted) is now settable end to end, not just enforced from the database.
  
  - **Server** — new `POST /billing/wallet/preferences` (requireAuth, `walletPreferencesSchema`): `wallet.setPreferences` writes the per-(subscriber, currency) flag via a new `setSpendPurchased` service (UPSERT — creates a zero-balance row if none exists) and returns the refreshed wallet, currency-scoped like `GET /billing/wallet`.
  - **Client** — `BillingClient.getWallet()` and `BillingClient.setWalletPreferences({ spendPurchased })` (with `IWalletDTO` / `IWalletResult` / `IWalletPreferencesInput`) — the first typed wallet surface in `@fonderie/client`.
  - **Hooks** — `useWalletPreferences()` in `@fonderie/react-billing` and `@fonderie/vue-billing` (read current value + `setSpendPurchased(bool)`, refresh-on-mount); carried into `@fonderie/react-native-billing` via its wholesale re-export.
  
  Additive/opt-in. Verified against real PostgreSQL (UPSERT on a no-row subscriber; toggle flips the debit hard-stop end to end) plus client/react/vue tests; adversarially reviewed. Wallet balance/transactions client+hooks remain a later cycle (still allow-listed).

### Patch Changes

- Updated dependencies [4e3991f]
  - @fonderie/client@0.12.0
  - @fonderie/react-billing@0.5.0
