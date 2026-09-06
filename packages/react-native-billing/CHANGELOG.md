# @fonderie/react-native-billing

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
