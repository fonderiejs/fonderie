---
'@fonderie/billing': minor
---

Add `checkPriceConsistency` — reconcile the catalog's prices against the provider's

A catalog entry with a `priceId` has its price declared in two places, and which
one the customer pays depends on how they buy: hosted checkout charges the
provider's price, while the saved-card and auto-recharge paths charge the
catalog's `priceAmount`/`currency`. Nothing enforced agreement, and disagreement
is silent — each path is internally consistent, so the only symptom is the same
pack costing different amounts through different flows.

`checkPriceConsistency(provider, config)` reports `amount`, `currency`, `both`,
`missing` (no such price) or `inactive` (archived at the provider, so checkout
would fail even though every figure matches) per entry, and
`describePriceProblems(report)` renders one log line each.

Async, like `checkWebhookRegistration` and for the same reason — reading a price
is a network call, so it cannot be a synchronous `checkReadiness()` hook. Call
it at boot or from a scheduled ops route. It never throws: a provider with no
price lookup reports `unsupported` rather than failing, since absence of the
capability is not evidence of a problem.
