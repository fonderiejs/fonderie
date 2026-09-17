---
'@fonderie/billing': minor
---

Add `checkSubscriptionDrift`, and a way to read a subscription back

`fonderie_subscriptions` is a **mirror**, fed entirely by webhooks. That is fine
while every delivery lands and silently wrong the moment one does not — and
deliveries stop for ordinary reasons: an endpoint disabled over a weekend, a
retry budget exhausted after ~3 days, a payload shaped by an API version the
normalizer did not expect.

Nothing inside the app could tell a correct mirror from one that stopped being
updated. Both look identical from the inside, so the question has to be asked of
the provider — and it could not be. `IBillingProvider` could `updateSubscription`,
`cancelSubscription` and `reactivateSubscription`, but had **no way to read one
back**. This is the only check in the package that needed a new seam method to
exist at all.

- `IBillingProvider.getSubscription?(id)` — optional, implemented by
  `StripeProvider`. A 404 returns `null` (an answer: the provider does not have
  it); anything else propagates, so an outage is never misread as "gone".
- `checkSubscriptionDrift(provider, store, { limit })` compares `status`,
  `currentPeriodEnd` and `cancelAtPeriodEnd`, and classifies the **direction**:
  `over-granting` (we serve a plan the provider stopped billing — quiet, costs
  money forever), `under-granting` (the provider bills someone we are not
  serving — loud, a support ticket today), or `metadata`.
- `describeSubscriptionDrift(report)` renders one line each, under-granting
  first.

Reports only; it does not write. Repairing the mirror changes who is served a
paid product, which is the app's decision to make.

Three deliberate quiet-by-default choices, each of which would otherwise make
the check noise on a healthy account: renewal dates compare at **day**
resolution (providers nudge the timestamp during retries and proration), the
**plan** is not compared at all (the stored plan name and the provider's
nickname-derived one disagree routinely), and a provider outage is reported as
an error with **no drift claimed** — misreading it as "every subscription is
gone" would invite a repair that cancels everyone.

Terminal rows are swept too: "we say canceled, the provider says active" is the
under-granting case, and filtering to non-terminal statuses would hide it. A
truncated sweep says so rather than capping silently.
