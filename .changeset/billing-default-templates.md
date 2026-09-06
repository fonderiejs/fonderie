---
'@fonderie/billing': major
---

Default templates for every billing notification + a small emitter change so money renders (P3 of the notification-template normalization).

**Feature (additive):** `@fonderie/billing` now exports `DEFAULT_TEMPLATES` covering all its notification keys — `subscription-canceled`, `payment-failed`, `trial-ending`, `renewal-receipt`, `limit-warning`, `limit-reached`, `credits-low`, `payment-receipt`, `refund-processed`, `auto-recharge-failed`. Pass to courier via `config.templates.defaults` and billing's emails render out of the box — the four wallet notices (`credits-low`, `payment-receipt`, `refund-processed`, `auto-recharge-failed`) that previously fell to a raw-JSON dump now render real copy. Override any key per-app with a DB row / FS file. Copy is brand-neutral and "balance"-centric (fits a money- or credit-denominated wallet). `satisfies Record<BillingMessageKey, IDefaultTemplate>` makes a missing key a compile error; a coverage test proves each renders cleanly with its real payload.

Because courier's `render()` can't format, three money/credit notices now carry pre-formatted `*Display` fields computed at emit by a new `formatWalletAmount(amount, currency, precision)` helper: `credits-low` (`balanceDisplay`, `thresholdDisplay`), `payment-receipt` and `refund-processed` (`creditsDisplay`, `balanceAfterDisplay`). Additive to the notification payload only — no change to any credit/debit/balance/idempotency logic.

**Breaking:** removed the dead `MESSAGE_KEYS.limitBlocked` (`'billing.limit-blocked'`) — it was never emitted (a hard limit block returns 429 directly), so no notification ever used it, but it was a public member of `MESSAGE_KEYS`. Any code referencing `MESSAGE_KEYS.limitBlocked` (a courier channels entry or template for it — necessarily dead, since it never fired) should drop that reference.

Requires `@fonderie/core >= 0.8.0` + `@fonderie/courier >= 5.2.0`.
