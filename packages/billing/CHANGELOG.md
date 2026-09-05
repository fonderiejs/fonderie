# @fonderie/billing

## 6.0.0

### Major Changes

- ee4a5fb: Subscription dates serialize explicitly; the dead usage DTO surface is removed
  
  `toSubscriptionDTO` passed pg `Date` objects straight into string-typed
  fields — the wire was ISO only by accident of `Date.toJSON`, and any
  server-side consumer doing string operations on `currentPeriodStart`,
  `currentPeriodEnd`, `trialEndsAt`, or `createdAt` got a `Date` where the
  type promised a string. The mapper now normalizes explicitly (nullables stay
  `null`), the same convention the wallet and customers paths follow.
  `GET /billing/usage/:metric` likewise sends `since` as an explicit ISO
  string instead of a raw `Date`.
  
  Removed: `IUsageRecordDTO`, `toUsageRecordDTO`, and the `IUsageRecord` row
  type — declared, exported, and mapped by no route ever; a repo-wide census
  found zero consumers. Their removal is what makes this a major; the wire
  behavior above is unchanged for JSON consumers.
- 720c47f: Stored-value wallet: ledger-backed credits, credit packs, and plan rates
  
  Billing gains an opt-in stored-value wallet (`config.wallet`). Subscribers
  hold a per-currency credit balance backed by an append-only ledger
  (`fonderie_wallet_ledger`) — the balance table is a cache that is never
  written without a ledger row in the same transaction, every mutation
  carries a UNIQUE idempotency key, and debits are atomic (`SELECT ... FOR
  UPDATE` plus a conditional-update overdraft floor, proven against real
  PostgreSQL by gated integration tests). New routes register only when
  `config.wallet` is present: `GET /billing/wallet`,
  `GET /billing/wallet/transactions`, `POST /billing/wallet/checkout`,
  `POST /billing/webhook/payment` (separate endpoint and secret from the
  subscription webhook), and an admin-token-guarded
  `POST /billing/wallet/grant`. Credit packs are config-defined
  (`wallet.creditPacks`) and synced to `fonderie_credit_packs`; plans can
  define wallet economics (`plan.wallet`: lazy periodic grants, per-metric
  rates, overdraft floor). Product code charges through
  `debitWalletForMetric` / `debitWallet` with an idempotency key;
  `requireWalletBalance(metric)` gates routes on affordability without
  debiting.
  
  Breaking: money amounts at the config and provider boundaries are now
  `bigint` — `IBillingPlanPrice.amount` (write `2900n` instead of `2900` in
  plan config) and `IResolvedPrice.unitAmount` (custom providers must return
  `bigint`). The HTTP wire format is unchanged: `IPlanDTO.pricing` still
  serializes as JSON numbers (bounded display cents, converted with a
  Number.MAX_SAFE_INTEGER guard), so existing clients and screens keep
  working. All NEW wallet DTO amounts serialize as digit strings, because
  wallet balances are unbounded accumulations where `number` would silently
  corrupt. `IBillingEvent` gains an optional normalized `payment` field and
  `IBillingProvider` an optional `createPaymentCheckoutSession` method —
  additive for custom providers; a provider without it answers wallet
  checkout with 501.
  
  Security hardening that ships with the wallet: `withBilling` now verifies
  workspace membership for header-derived subscribers (403 for non-members,
  fail-closed, mirroring the workspaces module's active-member predicate) —
  previously any authenticated caller could present another workspace's id in
  `X-Workspace-ID` and read or consume its billing surfaces; anonymous
  requests naming a workspace no longer build a billing context at all. The
  payment webhook credits only confirmed funds (`payment_status` gating, with
  `checkout.session.async_payment_succeeded` handled for delayed-notification
  methods) and requires its own `wallet.webhookSecret` — it deliberately does
  not fall back to the subscription endpoint's secret. Periodic grants apply
  only while the subscription is active or trialing.
  
  Migration `006_wallet.sql` adds `fonderie_wallet_balances`,
  `fonderie_wallet_ledger`, `fonderie_wallet_grants`, `fonderie_credit_packs`,
  a nullable `wallet` JSONB column on `fonderie_plans`, and widens the plan
  display-price columns to BIGINT. Subscription-only consumers that leave
  `config.wallet` unset see no wallet surfaces; the two changes that reach
  them are the `bigint` config literals and the workspace-membership check —
  an app that scopes billing with `X-Workspace-ID` but does NOT run
  `@fonderie/workspaces` (no `fonderie_role_user_workspaces` table) must stop
  sending the header or install the module, since such requests now fail
  closed with 403.

### Minor Changes

- 7f8778f: BillingInterval: one source of truth, exhaustive branching, honest Stripe fallback
  
  Every interval-typed surface now derives from `BillingInterval` instead of
  repeating the inline `'month' | 'year'` union: `ISubscription.interval`,
  `INormalizedSubscription.interval`, `IResolvedPrice.interval`, and
  `upsertSubscription`'s input. A new `BILLING_INTERVALS` tuple is the single
  value carrier — it drives the type, the `checkoutSchema` zod enum (previously
  a duplicated literal list), and a new exported `isBillingInterval` guard; the
  existing `BILLING_INTERVAL` object stays as the dot-access companion, pinned
  to the union with `satisfies`.
  
  The checkout controller's binary ternary became an exhaustive `switch` with a
  `never` default, and `StripeProvider`'s interval normalization no longer
  silently collapses everything non-year to month: unsupported Stripe intervals
  ('day', 'week') keep the historical month fallback but now log a warning, so
  a weekly price can't masquerade as monthly unnoticed.
  
  Net effect: adding a billing interval becomes a checklist of compiler errors
  starting at `BILLING_INTERVALS`, rather than a silent no-op. Additive —
  `BillingInterval` still resolves to `'month' | 'year'` and no wire format
  changes.

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
