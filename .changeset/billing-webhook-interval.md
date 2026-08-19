---
"@fonderie/billing": patch
---

Persist the billing interval (`month`/`year`) from Stripe subscription webhooks.
`normalizeSubscription` now reads `items[0].price.recurring.interval`, and the
webhook handler passes it through on upsert. Previously subscriptions created or
updated via webhook always defaulted to `month`, even for yearly plans.
