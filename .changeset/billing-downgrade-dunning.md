---
'@fonderie/billing': minor
---

Phase 4b: in-place upgrade (Claude-style), dunning grace, and consented-card auto-recharge

**Plan changes** — `POST /billing/checkout` now upgrades a live subscription **in place**, immediately, charging the prorated difference (`always_invoice`) — the same mechanism Claude's own subscription uses. A same-plan month→year commitment counts as an upgrade. A **downgrade is never done in place**: a lower-tier move (or any non-upgrade change — a lateral/same-tier switch, a year→month switch, or an untiered pair that can't be ranked) returns `422 PLAN_CHANGE_REQUIRES_CANCEL`. The member cancels (keeping access until the period ends) and subscribes to the lower plan once the current membership is over — and a `canceled` subscriber choosing a lower plan simply opens a fresh checkout. This removes any path to consume a higher plan mid-cycle and then downgrade for a credit. `IBillingProvider.updateSubscription` gains an optional `prorationBehavior`.

**Dunning grace** — new `IBillingConfig.dunning.graceDays`: a `past_due` subscriber keeps plan access for that many days past the failed-renewal date, so a transient card decline doesn't instantly lock out a paying customer while the provider retries. Applied consistently in `withBilling`'s access computation and in `requirePlan` (opt-in via `requirePlan(plans, store, { graceDays })`). Grace grants **access only** — it never issues a new periodic wallet credit while payment is failing. New exported helper `isWithinDunningGrace`.

**Consented-card auto-recharge (fix)** — auto-recharge now charges the *specific* card the buyer consented to at the pack checkout, not merely the newest card on the customer. The payment method is resolved at purchase (`IBillingProvider.getPaymentMethodForIntent`) and persisted (migration `009`, `payment_method_id`, refreshed only on a genuine new purchase and never nulled by an unresolved retry); `chargeOffSession` takes an explicit `paymentMethodId` and falls back to the newest card only when none is stored. A detached/invalid stored card fails definitively (backs off/disables) instead of looping. Closes the documented multi-card edge case.

Additive/opt-in throughout. Adversarially reviewed.
