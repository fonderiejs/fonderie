---
'@fonderie/billing': minor
---

In-app pack purchases can now bill the saved card through a real Stripe **invoice** instead of a bare charge, so the buyer gets a proper invoice — number + downloadable PDF + hosted page — alongside the card receipt (Anthropic-style). New optional `IBillingProvider.chargeViaInvoice` (implemented by `StripeProvider`: create → line item → finalize → pay off-session, currency pinned to the charge currency, idempotent per step, finalized-but-unpaid invoices voided, SCA/decline resolved to a status). `purchasePackWithSavedCard` prefers it when available and falls back to `chargeOffSession` (receipt only) otherwise; the wallet credit stays idempotent on the invoice's PaymentIntent, and the invoice surfaces automatically through `listInvoices`. No change to the wallet-credit, refund-clawback, or hosted-checkout paths.
