---
'@fonderie/billing': minor
---

Fix invoice webhooks silently dropping under a 2025+ endpoint API version, and detect the version gap

A provider renders a webhook payload in the version set on the **endpoint**, in
its dashboard — not the version this client pins in code. Those are two separate
settings and nothing held them together. Stripe moved the subscription under
`invoice.parent.subscription_details` and the PaymentIntent under
`invoice.payments` in 2025+, while `normalizeInvoice` read only the pre-2025
locations, so both ids came back `null`.

The controller then answered `200 {ignored:'no-matching-subscription'}`, which
the provider records as a **successful** delivery: no retry, no error, nothing
logged. Renewal receipts and the `invoicePaid` / `invoicePaymentFailed` events
stopped firing, and the pack-purchase orphan-heal could not match a payment.

- `normalizeInvoice` now reads the current locations first and falls back to the
  legacy ones — the same treatment `normalizeSubscription` already gave the
  billing period and `chargeViaInvoice` already gave the PaymentIntent.
- New `enrichInvoiceRefs` recovers the PaymentIntent, which a 2025+ payload
  **cannot** carry at all: it lives under `payments`, which a provider omits
  unless expanded, and a webhook cannot expand. Re-reading the invoice through
  this client resolves it, because an API *response* comes back in the version
  the client pins. Best-effort and never throws — a throw would become a 500 and
  the provider would redeliver forever.
- `checkWebhookRegistration` keeps the endpoint's `api_version` (it was fetching
  and discarding it) and compares it against the new `STRIPE_API_VERSION`
  constant, reporting `apiVersionMismatch` per endpoint. New
  `describeWebhookProblems(report)` renders one log line per problem, mirroring
  `describePriceProblems`.
- `IBillingProvider` gains an optional `apiVersion`, and `IWebhookRegistration`
  an optional `apiVersion`, so the comparison is provider-agnostic. A version is
  compared only when both sides state one.

A mismatch deliberately does **not** flip `ok`: that answers "will the events
arrive", and under a version difference they do. A difference is legitimate and
can be long-lived now that the normalizers read both shapes, so folding it into
`ok` would leave a deployment permanently red — which is how an alarm gets muted.
