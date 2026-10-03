---
'@fonderie/billing': minor
---

**A subscription that isn't paying no longer unlocks its plan.** A checkout that was never paid (`incomplete`), an `unpaid` or `paused` subscription, or one `past_due` beyond the dunning grace still names its paid plan — and `withBilling` used to hand out that plan's features, limits and seats anyway. Entitlements now follow payment: such a subscriber gets the free plan (`config.plans[0]`), exactly like a subscriber with no subscription, and gets the paid plan back the moment it pays. `IBillingContext.plan` is the plan in force; the new `IBillingContext.subscribedPlan` is the plan the subscription names.

**A workspace's limit notices go to the workspace owner.** A `limit-warning` / `limit-reached` notice for a workspace subscriber used to go to whichever member's request crossed the line. With `config.resolveRecipient` and an event bus wired (as production readiness already requires), it now goes to the subscriber's resolved contact — the owner — like every other billing notice.
