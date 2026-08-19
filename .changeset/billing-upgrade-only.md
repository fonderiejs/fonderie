---
"@fonderie/billing": minor
---

Enforce upgrade-only plan changes with proration. When a subscriber already has
an active subscription, `POST /billing/checkout`:
- rejects a same-or-lower tier with `DOWNGRADE_NOT_ALLOWED` (422), and
- for a higher tier, changes the existing Stripe subscription in place (new
  `provider.updateSubscription`) with `proration_behavior: 'always_invoice'` —
  charging the prorated difference immediately — instead of creating a second
  subscription. Returns `{ upgraded: true, plan }`.

Plans need a `tier` (already in the plan config) for ordering. New subscriptions
still use hosted Checkout as before.
