# Design: Stripe-authoritative pricing via `lookup_key` + hydration

**Status:** proposed (review round 1 incorporated) · **Package:** `@fonderie/billing` · **Target:** `5.2.0` (additive), cleanup in `6.0.0`

> **Implementation is blocked on §16.1 (transfer race) and §16.3 (legacy subscription
> mapping); §16.9 (kill-switch) is strongly recommended before rollout.** See
> §16 for the full failure-mode analysis.

## 1. Goal

Make **Stripe the single source of truth for money** (amount, currency, interval)
and turn Fonderie's plan pricing into a **read-through projection** of it. Fonderie
keeps only what Stripe can't model: plan `name`, `tier`, `features`/`limits`/`policy`,
and a **stable reference** to the Stripe price. Eliminate the duplicated
`amount`/`currency` that caused the drift bugs (hardcoded `USD`, plan mapping by
`nickname`, stale amounts, period-shape mismatch).

## 2. Problem

Today a plan lives in two places, so they drift:

| Data | Stripe owns it | Fonderie also stores it |
|---|---|---|
| amount | `Price.unit_amount` | config `monthly.amount` + `fonderie_plans.monthly_amount` |
| currency | `Price.currency` | hardcoded `'USD'` in `toPlanDTO` |
| interval | `Price.recurring.interval` | subscription row |
| plan name | — | config `name` / `Price.nickname` |
| tier / features / limits | — | config only |

Every billing patch we shipped (USD hardcode, nickname mapping, item-level period,
interval default) traces to this duplication.

## 3. Core decision

Reference Stripe prices by **`lookup_key`** (stable across price changes), not by
immutable `priceId`. Resolve `lookup_key → live Price` at runtime, cached.

> Stripe Prices are immutable — you never edit an amount; you create a new Price
> and archive the old. A `lookup_key` can be **transferred** to the new Price, so a
> stable key always resolves to the current active price.

## 4. Config changes (`config.ts`)

```ts
export interface IBillingPlanPrice {
  /** Stable Stripe Price lookup_key, e.g. "pro_monthly". Preferred. */
  lookupKey?: string;
  /** @deprecated Raw Stripe price id — fallback when lookupKey is absent. */
  priceId?: string;
  /** @deprecated Display amount in cents. Hydrated from Stripe; ignored when lookupKey resolves. */
  amount?: number;
}

export interface IBillingPlan {
  name: string;
  tier?: number;                      // Fonderie-owned (ordering, upgrade guard)
  trialDays?: number;
  monthly?: IBillingPlanPrice;
  yearly?: IBillingPlanPrice;
  policy?: Record<string, unknown>;   // features/limits — Fonderie-owned
}
```

Resolution precedence: **`lookupKey` → hydrate from Stripe** (authoritative); else
fall back to `priceId` + `amount` (deprecated, warns once at boot). `tier`/`policy`
stay config-only.

## 5. Provider interface (`providers/types.ts`)

```ts
export interface IResolvedPrice {
  priceId: string;
  lookupKey: string | null;
  unitAmount: number;    // cents
  currency: string;      // ISO 4217 (Stripe lowercases)
  interval: 'month' | 'year';
  nickname: string | null;
  productId: string;
  active: boolean;
}

// added to IBillingProvider:
resolvePricesByLookupKey(lookupKeys: string[]): Promise<Map<string, IResolvedPrice>>;
resolvePriceById(priceId: string): Promise<IResolvedPrice | null>;
```

**Stripe impl** (`providers/stripe.ts`):
```ts
stripe.prices.list({ lookup_keys, active: true, expand: ['data.product'] })
```
(Stripe guarantees ≤1 *active* price per lookup_key.)

## 6. Price cache

Module-owned TTL cache:
```ts
class PriceCache {
  get(key): IResolvedPrice | undefined
  setMany(prices): void
  invalidate(key?): void   // key omitted = clear all
}
```
- Default TTL ~5 min (config `pricingCacheTtlMs`).
- Read paths (`GET /plans`, checkout, upgrade) hit cache → provider on miss.
- Invalidated by webhooks (§8).

## 7. `toPlanDTO` — hydrate, don't hardcode (`dtos/billing.ts`)

Build plan DTOs from resolved Stripe prices:
```ts
const keys = [plan.monthly?.lookupKey, plan.yearly?.lookupKey].filter(Boolean);
const prices = await priceCache.resolve(keys, provider);

pricing: {
  monthly:  prices.get(monthlyKey)?.unitAmount ?? plan.monthly?.amount ?? 0,
  yearly:   prices.get(yearlyKey)?.unitAmount  ?? plan.yearly?.amount  ?? 0,
  currency: prices.get(monthlyKey)?.currency ?? prices.get(yearlyKey)?.currency ?? 'usd',
}
```
**Delete the hardcoded `currency: 'USD'`.** On Stripe failure serve last-cached; if
never cached, fall back to deprecated `amount` and set `pricingStale: true` on the DTO.

## 8. Webhooks (`constructEvent` + `webhook.controller`)

Handle price/product events → `priceCache.invalidate()`:
- `price.created`, `price.updated`, `price.deleted`
- `product.updated`

This makes "edit price in Stripe → app reflects it" near-instant, not just on TTL.

## 9. Checkout & upgrade resolve at call time

`checkout.controller` and `provider.updateSubscription` currently take a config
`priceId`. Resolve the **current** price from `lookupKey` at the moment of use so
checkouts/upgrades always bill the live active price — no code deploy after a price
change.

## 10. Boot-time config guard

On `boot()`, resolve every configured `lookupKey` — and **warm the cache** with the
results (§16.2). Behaviour on an unresolved key is **a warning, not fatal**, because
a deploy can legitimately coincide with a `lookup_key` transfer window (§16.1); a
fatal guard would make price changes unsafe. Provide `pricing.validateOnBoot: 'warn'
| 'error' | 'off'` (default `warn`) so strict environments can opt into fail-fast.

## 11. Plan attribution for subscriptions (dual mapping)

`normalizeSubscription` maps plan via `price.nickname` today. Active subscriptions
created before this change reference legacy prices that may have **no `lookup_key`**,
so we cannot drop the old mapping until they churn (§16.3). Resolve plan by
**precedence**, first match wins:

1. `price.lookup_key` → config `lookupKey`  (preferred)
2. `price.id` → config `priceId`            (deprecated)
3. `price.nickname` → config `name`         (legacy, sunset)

Each fallback logs a deprecation warning tagged with the subscription id. **Sunset:**
keep (2) and (3) until the last subscription created before `5.2.0` has renewed or
ended; earliest removal `6.0.0`, gated on a "no legacy-mapped subscriptions in the
last 30 days" metric.

## 12. Backward compatibility & versioning

- Additive & non-breaking: `lookupKey` optional; `priceId`/`amount` still work
  (deprecated, warn once). → **minor `5.2.0`**.
- Deprecate `amount`/`currency` duplication in JSDoc/docs now; **remove in `6.0.0`**.
- `fonderie_plans.*_amount` becomes derived/cache-only. **DB migration (§16.6):**
  `5.2.0` migration makes `monthly_amount`/`yearly_amount` **NULLable** and code stops
  writing them (dropping them in `5.2.0` would break rollback / old readers); `6.0.0`
  drops the columns after all readers are gone.

## 13. Migration for a user

1. In Stripe, add a `lookup_key` to each Price (`pro_monthly`, `pro_yearly`, …).
2. In config, replace `{ amount, priceId }` with `{ lookupKey: 'pro_monthly' }`.
3. Delete the hardcoded amounts.

Change a price later: new Price → transfer the lookup_key → webhook invalidates
the cache. **No Fonderie change.**

## 14. Tests

- `resolvePricesByLookupKey` maps Stripe → `IResolvedPrice` (mock provider).
- `GET /plans` reflects Stripe amount/currency; falls back to deprecated `amount`
  when no `lookupKey`; sets `pricingStale` on provider failure.
- Cache TTL + webhook invalidation; single-flight dedup coalesces concurrent misses (§16.2).
- Checkout/upgrade resolve the current price after a lookup_key transfer.
- Boot guard **warns** (not throws) on an unresolvable lookup_key at `validateOnBoot: 'warn'` (§10).
- Transfer-race grace: on a transient resolution miss, serves last-cached price within `transferGraceMs` (§16.1).
- Currency-mismatch validation throws when monthly/yearly resolve to different currencies (§16.4).
- Webhook dedup: replaying the same `event.id` invalidates the cache once (§16.5).
- Max-staleness: past `maxStaleMs`, plan DTO is `pricingStale`/unavailable, not a wrong price (§16.8).
- Kill-switch off (`lookupKeyHydration: false`) → deprecated `amount`/`currency` path (§16.9).
- Renewal: a lookup_key transfer does **not** change an existing subscription's next invoice (§16.11).

## 15. Out of scope

Tax, Stripe automatic multi-currency, and coupons stay Stripe-native; Fonderie
passes the resolved `priceId` to Checkout/subscription APIs.

**Existing subscribers are NOT re-priced (§16.11).** Stripe charges the `priceId`
pinned to the subscription item at renewal — transferring a `lookup_key` only affects
*new* checkouts/upgrades. Migrating live subscribers to a new price is an explicit,
separate operation (bulk `subscriptions.update` per item) and is out of scope here.

---

## 16. Edge cases, failure modes & operational hardening

Incorporated from design review. Items **16.1** and **16.3** block implementation;
**16.9** is required before rollout.

**16.1 — `lookup_key` transfer race (BLOCKER).** During a transfer A→B there is a
brief window with **zero** active prices for the key. Runtime resolution must tolerate
a transient miss and serve the **last-cached price even if TTL-expired**, for a grace
window (`pricing.transferGraceMs`, default 1h). Boot guard is non-fatal (§10).

**16.2 — Cache stampede on cold start.** Empty cache + traffic spike ⇒ concurrent
Stripe calls per key. Fix: warm the cache from the boot guard resolution, and add a
**single-flight `Promise` dedup map** so concurrent misses for the same key share one
Stripe request.

**16.3 — Legacy subscriptions with no `lookup_key` (BLOCKER).** See the dual-mapping
precedence and sunset gate in §11. Do **not** remove nickname/priceId mapping while
pre-`5.2.0` subscriptions are still active.

**16.4 — Currency mismatch monthly vs yearly.** DTO hydration must **validate** that a
plan's resolved monthly/yearly prices share a currency; mismatch ⇒ throw (config/Stripe
error) rather than silently emit inconsistent pricing.

**16.5 — Webhook robustness.** For the price/product events (§8): (a) verify the
signature via `constructEvent` (same path as subscription webhooks); (b) **dedupe** on
Stripe `event.id` (store processed ids ~24h) since Stripe re-delivers; (c) treat
ordering as unreliable — invalidate the cache on `price.created`/`price.updated`/
`price.deleted` regardless of arrival order (invalidate-and-refetch is order-safe).

**16.6 — `fonderie_plans` migration.** NULLable amounts in `5.2.0`, stop writing, drop
in `6.0.0` — see §12. Guards against NOT NULL failures and old readers.

**16.7 — Price change mid-checkout.** A Checkout session created with the old `priceId`
stays valid (Prices are immutable), so the user pays the **old** amount. **Policy:**
accept it — price changes apply to *new* checkouts only; document it. (Expiring live
sessions on price change is impractical.)

**16.8 — Extended Stripe outage.** Define **max staleness** (`pricing.maxStaleMs`,
default 24h): serve last-cached within it; beyond it, return `pricingStale: true` with
`unavailable` semantics rather than very-wrong prices. Emit a metric/alarm whenever a
`pricingStale` response is served.

**16.9 — Kill-switch / phased rollout (REQUIRED).** This changes how money is read, so
gate it behind `pricing.lookupKeyHydration: boolean` (config, flippable without deploy).
When off, fall back to the deprecated hardcoded `amount`/`currency` path. Lets us revert
instantly if hydration misbehaves.

**16.10 — Stripe test/live parity.** A `lookup_key` must exist in **both** Test and
Live. Add a release-checklist item, and have the boot guard warn (§10) when a key is
missing so staging surfaces it before prod.

**16.11 — Renewal does not re-price.** Documented in §15 — the spec's tests cover
checkout/upgrade resolution; renewal bills the subscription item's pinned price. Add a
test asserting a `lookup_key` transfer does **not** change an existing subscription's
next invoice.

---

**Net:** `lookupKey` (stable ref) + read-through hydration + webhook invalidation =
Stripe authoritative, Fonderie a live projection. The USD/nickname/interval/period
class of bugs becomes structurally impossible, and a non-owner can manage prices
entirely in Stripe.
