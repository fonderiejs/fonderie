---
'@fonderie/billing': major
---

Stripe API pin moves from `2024-11-20.acacia` to `2026-08-26.dahlia`

Three breaking-change boundaries are crossed at once — Acacia → Basil →
Clover → Dahlia. Most of it costs nothing, because invoice and subscription
payloads have been read version-tolerantly since 9.6.0: the item-level
billing periods, `invoice.parent` and `invoice.payments[]` that Basil
introduced were already the primary read paths, with the legacy fields as
fallbacks. Clover's breaking changes (discounts, promotion codes, currency
conversion, subscription schedules) touch nothing this provider uses.

**One code change was required.** Dahlia makes `payment_method_types`
read-only on Payment Intents and Setup Intents — sending it returns 400
`payment_method_types_no_longer_supported`. `createSetupIntent` sent it, so
in-app card entry would have failed on the first request after the bump. It
now sends `allowed_payment_method_types`, which filters incompatible types
out of the dynamic set instead of erroring. The public option name
`setupPaymentMethodTypes` is unchanged; consumers need no edit.

**Why major, and the part that is not in the diff.** Clover made *flexible
billing mode* the default for newly created subscriptions. That changes how
prorations, trials and usage-based billing are calculated for subscriptions
created after you upgrade. Existing subscriptions keep their current mode.
No code here references `billing_mode` — the behaviour changes underneath
it, which is exactly why this cannot ship as a minor.

**Align your webhook endpoints.** An endpoint's `api_version` is fixed at
creation and set in the Stripe dashboard, not by this pin; the two drift
independently. `checkReadiness()` reports the mismatch. Payload reads
tolerate a difference, so an unaligned endpoint is not an outage.

Verify against Stripe test mode before deploying. Stripe allows rolling an
account's API version back for 72 hours.
