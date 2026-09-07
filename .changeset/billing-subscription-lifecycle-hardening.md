---
'@fonderie/billing': minor
---

Close two subscription-lifecycle vulnerabilities found in a follow-up audit (both medium; each ships with a regression test, engine claims proven on the PG suite):

- **Optimistic reactivate/cancel could resurrect a terminally-canceled subscription.** The `provider_event_at` ordering guard intentionally exempts non-webhook writes (they carry a null token), so a reactivate or at-period-end cancel still in flight when a terminal `customer.subscription.deleted` webhook lands would rewrite the row back to active/paid — with no later webhook to correct it (deleted is terminal), leaving the subscriber with unbilled paid access. Those optimistic writes now pass `guardNotWebhookCanceled`, so the update no-ops over a webhook-canceled row and the controller reports the truthful terminal state (409 for reactivate, already-canceled for cancel) instead of a phantom success.
- **Unlimited free trials via cancel → resubscribe.** A canceled subscription row is overwritten on resubscribe, so it couldn't remember a trial had been used; checkout re-applied `plan.trialDays` every cycle (and, since trialing is grant-eligible, handed out a fresh wallet grant each period). A new durable `fonderie_subscription_trials` ledger records a consumed trial once (written by the subscription webhook when a subscription enters a trial); checkout now grants `trialDays` only to a subscriber who has never trialed.

No breaking changes; one additive table applied on boot (`fonderie_subscription_trials`).
