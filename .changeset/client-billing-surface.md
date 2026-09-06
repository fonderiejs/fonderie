---
'@fonderie/client': minor
---

Complete the `BillingClient` public surface so every user-facing billing route has a typed client method:

- `cancelSubscription(input?)` / `reactivateSubscription()` — first-party subscription lifecycle (no billing-portal round-trip), returning the new lifecycle state.
- `createWalletCheckout({ packId })` — start a one-time credit-pack purchase (returns a hosted checkout URL).
- `getWalletTransactions({ cursor?, limit? })` — the cursor-paginated wallet ledger (each entry carries `balanceAfter`).
- `getPaymentMethod()` — the customer's card on file (brand/last4/expiry), for `@fonderie/billing`'s new `/billing/payment-method` route.
- `listInvoices()` — the customer's invoices (each links to the hosted invoice/PDF), for the new `/billing/invoices` route.

Adds the matching result/input types (`ISubscriptionChangeResult`, `IWalletTransactionDTO`/`IWalletTransactionsResult`, `IWalletCheckoutInput`, `ICancelSubscriptionInput`, `IPaymentMethodDTO`/`IPaymentMethodResult`, `IInvoiceDTO`/`IInvoicesResult`). All are additive.
