---
'@fonderie/billing': minor
---

Harden the wallet + subscription money paths against provider webhook races and mis-attribution (5 audit findings; no breaking changes, two additive nullable columns applied on boot):

- **Refund-before-credit clawback drop.** Pack charges now carry their own metadata (via `payment_intent_data.metadata`), and a refund/chargeback that arrives before its purchase credit returns a retryable `CLAWBACK_DEFERRED` instead of being silently ignored — so the provider re-delivers and the clawback lands once the credit exists.
- **Subscription webhook ordering race.** `customer.subscription.*` events are at-least-once and unordered; a retried/out-of-order event could resurrect a canceled or downgraded subscription. The provider event timestamp (`event.created`, exposed as `IBillingEvent.eventAt`) is now stored as `provider_event_at` and the upsert no-ops any event older than the one already applied. A rejected stale event also fires no lifecycle domain event or customer notice, closing the event-bus twin of the same bug.
- **Checkout orphaning a paused/unpaid subscription.** `paused` and `unpaid` subscriptions still exist at the provider; a plan change now refuses them with clear guidance (`SUBSCRIPTION_PAST_DUE` / `SUBSCRIPTION_PAUSED`) instead of opening a fresh checkout that nulls the live `provider_subscription_id`.
- **Auto-recharge idempotency key past its TTL.** A pending idempotency key aged past the provider's retention (~24h) no longer dedupes; reusing it would double-charge. The claim now records when the key was minted (`pending_recharge_key_at`) and, once it is stale, stops rather than charging — disabling auto-recharge and surfacing the stuck charge for reconciliation (a new purchase re-arms it).
- **Admin grant currency.** A manual grant with no explicit currency now targets the subscriber's plan-wallet currency (the bucket they actually spend from), not the global default — so credits are no longer stranded in an unspendable bucket for non-default-currency plans.
