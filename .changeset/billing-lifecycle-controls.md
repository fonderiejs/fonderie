---
'@fonderie/billing': minor
---

Phase 4: first-party subscription cancel & reactivate

Two new session-authenticated routes give customers self-serve cancellation without the hosted billing portal:

- **`POST /billing/subscription/cancel`** — `atPeriodEnd` defaults to `true` (keep access until the paid-through date); `false` cancels immediately.
- **`POST /billing/subscription/reactivate`** — un-cancel a subscription scheduled to cancel at period end (idempotent).

New optional provider methods `IBillingProvider.cancelSubscription` / `reactivateSubscription` (Stripe implemented via `cancel_at_period_end` / `subscriptions.cancel`), returning `ISubscriptionChange`. When a provider doesn't implement them the routes answer `501` (the hosted portal remains a fallback).

The controller performs the provider change and updates the stored subscription **optimistically** (so the next read reflects it), but deliberately emits **no events and no notices** — the provider webhook (`customer.subscription.updated`/`.deleted`) stays the single source of truth for the lifecycle event + the `billing.subscription-canceled` notice, so a cancellation is announced exactly once. Routes are behind `requireAuth` and the `withBilling` workspace-membership guard, so a caller can only act on their own subscription.

This is the "cancel endpoint" from the capability audit. **Downgrade (scheduled plan-change) and dunning-grace remain out of scope** — downgrade needs Stripe subscription schedules and is deferred to a Phase 4b. Additive/opt-in.
