---
'@fonderie/billing': minor
---

Detect webhook events that were never registered

Two failures hide behind "the webhook isn't working", and only one of them is
visible in traffic:

- **Registered but not handled** — the event arrives, no branch matches, the
  webhook returns 200 and nothing happens. Harmless, and observable.
- **Handled but not registered** — nothing arrives at all. No error, no
  delivery, no log line. Dunning silently stops happening, cancellations are
  never processed, wallets are never credited. From inside the app "no
  `invoice.payment_failed` yet" and "`invoice.payment_failed` will never arrive"
  are indistinguishable, so no amount of logging finds it.

The second can only be found by asking the provider what it was configured to
send. `checkWebhookRegistration(provider, urls)` does that and reports, per
endpoint, which consumed events are missing and which registered events nothing
consumes. A disabled endpoint fails the check even with every event selected,
since it delivers nothing. It never throws — a health check must not take down
the route reporting on it — and a provider without the capability reports
`unsupported` rather than failing.

New optional `IBillingProvider.listWebhookRegistrations()`, implemented for
Stripe (paginated). Optional, so existing providers and test doubles are
unaffected.

The consumed events are now declared once and exported —
`SUBSCRIPTION_WEBHOOK_EVENTS`, `PAYMENT_WEBHOOK_EVENTS`, `ALL_WEBHOOK_EVENTS`,
`isConsumedWebhookEvent` — instead of existing only as a scatter of
`raw.type === …` branches that every runbook had to transcribe by hand. The
normalizer reads the subscription set from that declaration, and a test diffs
the list against the branches in both directions, so it cannot drift into being
a confident lie.

Both webhook endpoints now also warn once per process when they receive an event
nothing consumes.
