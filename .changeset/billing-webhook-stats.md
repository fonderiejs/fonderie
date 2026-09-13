---
'@fonderie/billing': minor
---

Add `webhookStats()` — whether the payment provider is actually reaching this deployment.

A stale webhook secret is the worst kind of outage: the provider charges the card and reports success, the endpoint rejects the signature with a 400 that exists only in a log, and the customer is paid-up with nothing credited. Nothing in the product looks wrong until someone complains.

Returns the two things a working webhook actually MOVES — `lastEventAt` (advances only on a signature-verified subscription event) and wallet `purchases` — so a stale secret is detectable without any provider API access. After re-pointing an endpoint or rotating a secret, send a test event and watch `lastEventAt` advance.

It also returns `subscriptions`, deliberately. `lastEventAt: null` means two opposite things on its own: nobody has ever subscribed, or subscriptions exist and no webhook has ever been accepted for them. Only the second is an outage, and the count is what tells them apart — an app reading the timestamp alone will draw the wrong conclusion, which is exactly what happened before this existed.

This replaces hand-written SQL in apps against `fonderie_subscriptions` and `fonderie_wallet_ledger`. Reaching into another package's schema is how a wrong column name shipped elsewhere in this repo and threw on every real database.
