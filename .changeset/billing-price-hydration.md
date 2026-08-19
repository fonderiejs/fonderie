---
"@fonderie/billing": minor
---

Read-through pricing hydration (core slice, behind a kill-switch). When
`config.pricing.hydration` is enabled, `GET /plans` resolves each plan's live
amount + currency from Stripe (source of truth) instead of the hardcoded config
`amount` / `'USD'`, via a new `PriceCache` (TTL + single-flight dedup + transfer-
race grace + outage max-staleness). Adds `provider.resolvePriceById` /
`resolvePricesByLookupKey`, `IResolvedPrice`, `IBillingPlanPrice.lookupKey`, and
`BILLING_INTERVAL`. Off by default — deprecated hardcoded path unchanged. Currency
mismatch between a plan's monthly/yearly prices is detected (best-effort, flags
`pricingStale`). See packages/billing/docs/pricing-hydration.md.
