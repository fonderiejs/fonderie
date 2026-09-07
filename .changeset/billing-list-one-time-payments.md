---
'@fonderie/billing': minor
---

`GET /billing/invoices` now includes one-time payments, not just subscription invoices. A credit-pack purchase is a bare Stripe PaymentIntent/Charge, never a Stripe Invoice, so `stripe.invoices.list` never returned it — the money showed in Stripe but the buyer had no record of it in-app. `StripeProvider.listInvoices` now also lists the customer's one-time charges (those not tied to a subscription invoice, and captured), mapped to the same summary shape with the Stripe-hosted **receipt URL** as `hostedInvoiceUrl`, merged newest-first with subscription invoices. Subscription-invoice charges are excluded (`charge.invoice != null`) so nothing double-counts.
