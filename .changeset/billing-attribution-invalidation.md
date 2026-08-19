---
"@fonderie/billing": minor
---

Complete the pricing-hydration wiring: (§16.3) attribute subscriptions to plans
by price with precedence `lookup_key → priceId → nickname` — `normalizeSubscription`
now exposes `priceLookupKey`/`priceId`, and the webhook upsert resolves the plan via
the new pure `resolvePlanNameByPrice(price, plans)` (deletions still resolve to
free/canceled). (§8) `customer`-price/product webhooks (`price.*`, `product.*`)
invalidate the shared `PriceCache`, so a price edit in Stripe is reflected without
waiting for TTL.
