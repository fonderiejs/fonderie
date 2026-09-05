---
'@fonderie/billing': minor
---

Phase 3b: invoice, trial-ending, and one-time payment-failure normalization (dunning + renewal receipts, notification-only)

The Stripe provider now normalizes four more event families into `IBillingEvent` (additive optional slots `invoice` / `paymentFailure`, plus `trial_will_end` via the existing subscription slot):

- **`invoice.paid`** → a **renewal receipt** (`billing.renewal-receipt` notice + `fonderie.billing.invoice.paid` event), one per successful subscription renewal.
- **`invoice.payment_failed`** → a durable **`fonderie.billing.invoice.payment_failed` event only, deliberately no email** — the dunning notice already fires exactly once on the `past_due` transition (Phase 2), so emitting here too would double-dun. The richer event lets you build retry cadence.
- **`checkout.session.async_payment_failed` / `payment_intent.payment_failed`** → a **`billing.payment-failed`** notice + `fonderie.billing.payment.failed` event for failed *one-time* (credit-pack) payments; unattributable failures are acknowledged and ignored.
- **`customer.subscription.trial_will_end`** → a **`billing.trial-ending`** notice + `fonderie.billing.subscription.trial_will_end` event, **without mutating subscription state** (it's a heads-up; nothing changed yet). This is the "your trial ends in 3 days" signal.

No money moves. New surface: `INormalizedInvoice`, `INormalizedPaymentFailure`, `getSubscriberByProviderSubscriptionId` (resolves who to notify from an invoice's provider subscription id), and the new `MESSAGE_KEYS`/`EVENT_KEYS`. Additive and opt-in — a provider that doesn't normalize these events is unaffected, and notices only send when `resolveRecipient` + a bus are wired.
