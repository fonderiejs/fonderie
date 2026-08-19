# Design: Stripe-authoritative pricing via `lookup_key` + hydration

**Status:** proposed · **Package:** `@fonderie/billing` · **Target:** `5.2.0` (additive), cleanup in `6.0.0`

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

Extend config validation (like the `jwtSecret` guard): on `boot()`, resolve every
configured `lookupKey`. Any that doesn't resolve to an active Stripe price → **fail
fast** with a clear error (catches typos / un-transferred keys before checkout).

## 11. `nickname` → no longer plan identity

`normalizeSubscription` maps plan via `price.nickname` today. Prefer mapping the
subscription's `price.lookup_key` (or product) back to the Fonderie plan by matching
config `lookupKey`. Robust even when a nickname is missing.

## 12. Backward compatibility & versioning

- Additive & non-breaking: `lookupKey` optional; `priceId`/`amount` still work
  (deprecated, warn once). → **minor `5.2.0`**.
- Deprecate `amount`/`currency` duplication in JSDoc/docs now; **remove in `6.0.0`**.
- `fonderie_plans.*_amount` becomes derived/cache-only (dropped in `6.0`).

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
- Cache TTL + webhook invalidation.
- Checkout/upgrade resolve the current price after a lookup_key transfer.
- Boot guard fails on an unresolvable lookup_key.

## 15. Out of scope

Tax, Stripe automatic multi-currency, and coupons stay Stripe-native; Fonderie
passes the resolved `priceId` to Checkout/subscription APIs.

---

**Net:** `lookupKey` (stable ref) + read-through hydration + webhook invalidation =
Stripe authoritative, Fonderie a live projection. The USD/nickname/interval/period
class of bugs becomes structurally impossible, and a non-owner can manage prices
entirely in Stripe.
