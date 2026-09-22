---
'@fonderie/billing': minor
---

A plan price can declare its `currency`, so the consistency check can compare it

A credit pack declares a currency, so a catalog quoting USD against a provider
price in CAD is reported. A plan had nowhere to say one, so only the amount was
compared and the identical mistake passed silently — the figures agree, and
nothing points out that the pricing page quotes a currency no one is charged in.

`IBillingPlanPrice.currency` is optional and display-only; the provider stays
the authority for the actual charge. Unset keeps today's behaviour exactly —
amount only — so nothing changes for an existing catalog until it opts in.

Found by the price-consistency check flagging exactly this on a real
deployment's packs while its subscription, with the same mismatch, passed.
