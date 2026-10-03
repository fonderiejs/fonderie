---
'@fonderie/billing': minor
---

**`GET /plans` says what each plan includes.** A plan configured with `policy: { seats: { limit: 5 }, analytics: { enabled: true }, … }` was served as `seats: null, features: []` — the stored row's columns are only written by the plan-admin routes — so a pricing page had nothing to show but a name and a price. The DTO now fills `seats` and `features` (name, enabled, limit) from the configured policy when the row carries none; an operator's explicit values still win.

With `pricing.hydration`, the free plan also adopts the currency every priced plan shares, instead of showing `USD` next to plans hydrated to `CAD`.
