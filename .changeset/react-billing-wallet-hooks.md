---
'@fonderie/react-billing': minor
---

Add hooks for the full wallet + billing-account surface, so a React billing page needs no hand-rolled fetches:

- `useWallet()` — the stored-value balance (reads `GET /billing/wallet`).
- `useWalletTransactions()` — the cursor-paginated ledger, with `loadMore()`.
- `useWalletCheckout()` — start a one-time credit-pack purchase (returns the hosted URL to redirect to).
- `useCancelSubscription()` / `useReactivateSubscription()` — first-party lifecycle controls (no billing-portal round-trip).
- `usePaymentMethod()` — the card on file; treats a provider `501` as "no card", not an error.
- `useInvoices()` — invoice history (each links to the hosted invoice/PDF); `501` reads as an empty list.

Follows the existing hook conventions (context-resolved client, `{ isLoading, error, refresh }` reads / action mutations). `@fonderie/react-native-billing` re-exports these unchanged.
