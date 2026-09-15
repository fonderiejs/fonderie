---
'@fonderie/billing': patch
---

Stop a subscription webhook from 500ing when the provider carries no subscriber metadata

A provider subscription identifies its owner through metadata, but plenty of real
subscriptions have none: created in the provider's dashboard, imported from another
system, restored from a backup, or produced by `stripe trigger`. The normalizer
represents that absence as `subscriberId: ''`, and `''` is not a uuid — so the id
reached the store and raised `invalid input syntax for type uuid: ""`, failing the
webhook with a 500.

A 500 is the worst available answer here. The provider reads it as a transient
fault and redelivers the same un-actionable event on a backoff schedule, so a
single unowned subscription becomes a permanent stream of failing deliveries that
buries real ones in the log.

The identity is now resolved once, before any branch uses it. When the
subscription is genuinely ours with its metadata stripped, the owner is recovered
from `provider_subscription_id` — the same join the invoice branch already trusts —
so a real subscription is no longer silently desynced. Only when that finds nothing
is the event declined, and declining is a `200 {ignored:'no-subscriber-metadata'}`:
the event is validly signed and simply not ours to act on, so the provider must not
retry it.

Placed ahead of the `trial_will_end` branch as well, which reached the recipient
lookup with the same empty id.
