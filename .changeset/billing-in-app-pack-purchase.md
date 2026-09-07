---
'@fonderie/billing': minor
---

Add an in-app credit-pack purchase that charges the subscriber's saved card instead of redirecting to hosted checkout. New route `POST /billing/wallet/purchase` ({ packId, idempotencyKey }): it charges the card on file via the provider's off-session PaymentIntent and credits the wallet, so a buyer with a saved card never leaves the site.

Money-safety mirrors the audited auto-recharge path: the charge is idempotent on the client-supplied key (a double-submit or a retry after an indeterminate response dedupes to the same PaymentIntent), and the wallet credit is idempotent on the resulting charge id (no double-credit; proven on Postgres). Outcomes are returned as a status, not a throw — `credited`, `checkout_required` (no saved card, or the card needs 3-D Secure → the caller falls back to hosted checkout, which authenticates in-flow), `declined`, or `processing` (indeterminate — retry with the same key, never a new hosted payment, so it can't double-charge). The credit records `providerTxId`/`amountPaid`/`paymentCurrency`/`packId` so a later refund or chargeback prorates the clawback exactly as the hosted-checkout path does, and respects the `blockPacksWhileSubscribed` (GAP-1) policy.
