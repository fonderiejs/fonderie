---
'@fonderie/billing': patch
---

**A subscription payment is listed once, not twice.** `GET /billing/invoices` lists the customer's invoices and also its bare charges, so a credit-pack purchase (a charge, never an invoice) has a record. It skipped charges that pay an invoice with `!charge.invoice`, but since Stripe's basil API version a Charge has no `invoice` field. On the pinned dahlia version, every subscription payment showed twice: as its numbered invoice and as an unnumbered "paid" row. Only billing's own pack charges are listed now, recognised by `metadata.packId`, which billing sets on every pack payment and Stripe copies to the charge.

**A customer who just paid has a card on file.** Hosted Checkout (subscriptions and credit packs) never restricted payment methods, so Stripe also offered Link and Klarna. A subscription paid with Link saves a `type: 'link'` method with no card details, and the billing screen reported "no card on file" right after payment. Checkout now offers the same methods as in-app card entry, `setupPaymentMethodTypes` (default card only), so whatever a customer pays with can be shown. To offer wallets, add them to that option, accepting that they won't render as a card.
