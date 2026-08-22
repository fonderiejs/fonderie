---
"@fonderie/customers": major
"@fonderie/billing": patch
---

**customers (breaking):** the long-deprecated `EmailLabel`/`PhoneLabel`/`AddressLabel` type aliases are removed — labels have been resolved dynamically via `fonderie_customer_labels` for a long time and nothing consumed the aliases.

**billing:** `IBillingPlanPrice.amount` is no longer marked deprecated — it was never legacy: it's the seed value for `fonderie_plans` and the `pricingStale` fallback when hydration is off or Stripe is unreachable. The doc comment now states that role accurately.
