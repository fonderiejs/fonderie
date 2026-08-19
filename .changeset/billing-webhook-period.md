---
"@fonderie/billing": patch
---

Fix webhook subscription handling for Stripe API 2025+ where `current_period_start`/
`current_period_end` moved from the subscription to its line items. `normalizeSubscription`
now reads the period from `items[0]` (falling back to the subscription-level fields for
older API versions). Previously a real `customer.subscription.*` webhook produced an
invalid timestamp and failed the upsert with a 500.
