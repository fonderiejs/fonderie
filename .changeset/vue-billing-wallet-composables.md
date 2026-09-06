---
'@fonderie/vue-billing': minor
---

Add the wallet + billing-account + lifecycle composables, reaching parity with `@fonderie/react-billing`:

- `useWallet()` — the stored-value balance (`GET /billing/wallet`).
- `useWalletTransactions()` — the cursor-paginated ledger, with `loadMore()` and a computed `hasMore`.
- `useWalletCheckout()` — start a one-time credit-pack purchase (returns the hosted URL to redirect to).
- `useCancelSubscription()` / `useReactivateSubscription()` — first-party lifecycle controls (no billing-portal round-trip).
- `usePaymentMethod()` — the card on file; a provider `501` reads as "no card", not an error.
- `useInvoices()` — invoice history (each links to the hosted invoice/PDF); `501` reads as an empty list.

Follows the existing composable conventions (context-resolved client via `useFonderieSubClient`, `Ref`-based reactive state, `onMounted` reads / throwing action mutations).
