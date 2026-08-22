# @fonderie/billing

## 5.3.1

### Patch Changes

- 9be96e1: **customers (breaking):** the long-deprecated `EmailLabel`/`PhoneLabel`/`AddressLabel` type aliases are removed — labels have been resolved dynamically via `fonderie_customer_labels` for a long time and nothing consumed the aliases.
  
  **billing:** `IBillingPlanPrice.amount` is no longer marked deprecated — it was never legacy: it's the seed value for `fonderie_plans` and the `pricingStale` fallback when hydration is off or Stripe is unreachable. The doc comment now states that role accurately.

## 5.3.0

### Minor Changes

- e39f85f: Complete the pricing-hydration wiring: (§16.3) attribute subscriptions to plans
  by price with precedence `lookup_key → priceId → nickname` — `normalizeSubscription`
  now exposes `priceLookupKey`/`priceId`, and the webhook upsert resolves the plan via
  the new pure `resolvePlanNameByPrice(price, plans)` (deletions still resolve to
  free/canceled). (§8) `customer`-price/product webhooks (`price.*`, `product.*`)
  invalidate the shared `PriceCache`, so a price edit in Stripe is reflected without
  waiting for TTL.

## 5.2.0

### Minor Changes

- 7f9c72d: Read-through pricing hydration (core slice, behind a kill-switch). When
  `config.pricing.hydration` is enabled, `GET /plans` resolves each plan's live
  amount + currency from Stripe (source of truth) instead of the hardcoded config
  `amount` / `'USD'`, via a new `PriceCache` (TTL + single-flight dedup + transfer-
  race grace + outage max-staleness). Adds `provider.resolvePriceById` /
  `resolvePricesByLookupKey`, `IResolvedPrice`, `IBillingPlanPrice.lookupKey`, and
  `BILLING_INTERVAL`. Off by default — deprecated hardcoded path unchanged. Currency
  mismatch between a plan's monthly/yearly prices is detected (best-effort, flags
  `pricingStale`). See packages/billing/docs/pricing-hydration.md.

## 5.1.0

### Minor Changes

- fe93b90: Enforce upgrade-only plan changes with proration. When a subscriber already has
  an active subscription, `POST /billing/checkout`:
  - rejects a same-or-lower tier with `DOWNGRADE_NOT_ALLOWED` (422), and
  - for a higher tier, changes the existing Stripe subscription in place (new
    `provider.updateSubscription`) with `proration_behavior: 'always_invoice'` —
    charging the prorated difference immediately — instead of creating a second
    subscription. Returns `{ upgraded: true, plan }`.
  
  Plans need a `tier` (already in the plan config) for ordering. New subscriptions
  still use hosted Checkout as before.

## 5.0.2

### Patch Changes

- 38daf65: Fix webhook subscription handling for Stripe API 2025+ where `current_period_start`/
  `current_period_end` moved from the subscription to its line items. `normalizeSubscription`
  now reads the period from `items[0]` (falling back to the subscription-level fields for
  older API versions). Previously a real `customer.subscription.*` webhook produced an
  invalid timestamp and failed the upsert with a 500.

## 5.0.1

### Patch Changes

- 43fc0c5: Persist the billing interval (`month`/`year`) from Stripe subscription webhooks.
  `normalizeSubscription` now reads `items[0].price.recurring.interval`, and the
  webhook handler passes it through on upsert. Previously subscriptions created or
  updated via webhook always defaulted to `month`, even for yearly plans.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0

## 4.0.0

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0

## 1.1.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.1.0

### Minor Changes

- One request-validation layer across every endpoint-exposing package:

  - `validate(schema)` middleware in `@fonderie/core/middlewares` (structural
    `safeParse` interface — core stays dependency-free)
  - zod request schemas on all 43 body-taking routes across auth, workspaces,
    billing, customers, and webhooks; invalid input returns 422
    `INVALID_PARAMETER` with a field path before the controller runs; parsed
    bodies are trimmed and stripped of unknown keys
  - schemas exported per package (`schemas.*`) so docs generators and typed
    clients read the same contract the runtime enforces
  - provider-shaped webhooks (`/billing/webhook`, `/courier/delivery/*`) are
    deliberately exempt — gated by signature verification instead

## 1.0.1

### Patch Changes

- Packaging and DX fixes found by dogfooding a fresh AI-agent install:

  - Every `@fonderie/*/migrations` subpath now actually ships its declared
    `index.d.ts` — the two parallel tsup dts passes raced over `dist/` and the
    migrations declaration was lost on multi-entry packages. Migrations now
    build as a separate sequential pass.
  - The adapters' optional peers are now truly optional: `withWorkspace`,
    `requirePermission`, and `requireFeature` lazy-load
    `@fonderie/workspaces`/`permissions`/`billing` on first request instead of
    statically importing them at module load, with a targeted install error
    when the peer is genuinely missing.
  - `OPERATIONS` and the `Operation` type moved to `@fonderie/core`;
    `@fonderie/permissions` and the adapters re-export them unchanged.

- Updated dependencies
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/store@0.1.0
