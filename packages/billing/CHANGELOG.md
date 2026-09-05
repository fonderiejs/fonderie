# @fonderie/billing

## 6.3.0

### Minor Changes

- a45f235: Phase 4b: in-place upgrade (Claude-style), dunning grace, and consented-card auto-recharge
  
  **Plan changes** — `POST /billing/checkout` now upgrades a live subscription **in place**, immediately, charging the prorated difference (`always_invoice`) — the same mechanism Claude's own subscription uses. A same-plan month→year commitment counts as an upgrade. A **downgrade is never done in place**: a lower-tier move (or any non-upgrade change — a lateral/same-tier switch, a year→month switch, or an untiered pair that can't be ranked) returns `422 PLAN_CHANGE_REQUIRES_CANCEL`. The member cancels (keeping access until the period ends) and subscribes to the lower plan once the current membership is over — and a `canceled` subscriber choosing a lower plan simply opens a fresh checkout. This removes any path to consume a higher plan mid-cycle and then downgrade for a credit. `IBillingProvider.updateSubscription` gains an optional `prorationBehavior`.
  
  **Dunning grace** — new `IBillingConfig.dunning.graceDays`: a `past_due` subscriber keeps plan access for that many days past the failed-renewal date, so a transient card decline doesn't instantly lock out a paying customer while the provider retries. Applied consistently in `withBilling`'s access computation and in `requirePlan` (opt-in via `requirePlan(plans, store, { graceDays })`). Grace grants **access only** — it never issues a new periodic wallet credit while payment is failing. New exported helper `isWithinDunningGrace`.
  
  **Consented-card auto-recharge (fix)** — auto-recharge now charges the *specific* card the buyer consented to at the pack checkout, not merely the newest card on the customer. The payment method is resolved at purchase (`IBillingProvider.getPaymentMethodForIntent`) and persisted (migration `009`, `payment_method_id`, refreshed only on a genuine new purchase and never nulled by an unresolved retry); `chargeOffSession` takes an explicit `paymentMethodId` and falls back to the newest card only when none is stored. A detached/invalid stored card fails definitively (backs off/disables) instead of looping. Closes the documented multi-card edge case.
  
  Additive/opt-in throughout. Adversarially reviewed.

## 6.2.0

### Minor Changes

- f8d1983: Wallet auto-recharge — automatic off-session top-up when a balance runs low
  
  A plan wallet can now opt into auto-recharge:
  
  ```ts
  wallet: { autoRecharge: { threshold: 500n, packId: 'refill_20' } }
  ```
  
  When a subscriber's balance drops to `threshold`, `withBilling` charges the named credit pack's price against the card saved at the last pack purchase and credits its credits — no user interaction. This is the highest-leverage add for prepaid/metered products: users never hit a hard zero mid-usage.
  
  Money-safety (the same rigor as the debit and clawback paths):
  - **Atomic claim** — a single conditional `UPDATE` (`claimAutoRecharge`) row-locks per subscriber, so a burst of low-balance requests fires **exactly one** charge per cooldown window (proven on real Postgres). A failed attempt still consumes the window, so a declined card is never hammered.
  - **Idempotent credit** — the wallet is credited keyed on the provider charge id, so a retry never double-credits.
  - **Graceful failure** — a decline resolves to a status (not a throw): it's recorded, backed off, and auto-recharge is **disabled after N consecutive failures** (default 3), re-armed by the next successful purchase. Emits `fonderie.billing.auto_recharge.failed` + a `billing.auto-recharge-failed` notice.
  - **Fire-and-forget** — triggered from `withBilling` without blocking or failing the request; all safety lives in the service.
  
  New surface: `IBillingProvider.chargeOffSession` (Stripe implemented — off-session PaymentIntent), `createPaymentCheckoutSession({ savePaymentMethod })` (sets `setup_future_usage`), `INormalizedPayment.customerId`, migration `008_wallet_customers` (persists the customer holding the saved card + the recharge guard state), and `maybeAutoRecharge` / the `wallet-customers` service helpers. `BillingModule.checkReadiness()` warns when auto-recharge is configured but the provider can't charge off-session or the `packId` is unknown.
  
  **Consent note:** enabling auto-recharge makes the pack checkout save the card for later charges — the operator must surface the required consent that the card will be charged automatically. Additive and opt-in: absent `autoRecharge`, nothing changes and no card is saved.
- 7533061: Phase 3b: invoice, trial-ending, and one-time payment-failure normalization (dunning + renewal receipts, notification-only)
  
  The Stripe provider now normalizes four more event families into `IBillingEvent` (additive optional slots `invoice` / `paymentFailure`, plus `trial_will_end` via the existing subscription slot):
  
  - **`invoice.paid`** → a **renewal receipt** (`billing.renewal-receipt` notice + `fonderie.billing.invoice.paid` event), one per successful subscription renewal.
  - **`invoice.payment_failed`** → a durable **`fonderie.billing.invoice.payment_failed` event only, deliberately no email** — the dunning notice already fires exactly once on the `past_due` transition (Phase 2), so emitting here too would double-dun. The richer event lets you build retry cadence.
  - **`checkout.session.async_payment_failed` / `payment_intent.payment_failed`** → a **`billing.payment-failed`** notice + `fonderie.billing.payment.failed` event for failed *one-time* (credit-pack) payments; unattributable failures are acknowledged and ignored.
  - **`customer.subscription.trial_will_end`** → a **`billing.trial-ending`** notice + `fonderie.billing.subscription.trial_will_end` event, **without mutating subscription state** (it's a heads-up; nothing changed yet). This is the "your trial ends in 3 days" signal.
  
  No money moves. New surface: `INormalizedInvoice`, `INormalizedPaymentFailure`, `getSubscriberByProviderSubscriptionId` (resolves who to notify from an invoice's provider subscription id), and the new `MESSAGE_KEYS`/`EVENT_KEYS`. Additive and opt-in — a provider that doesn't normalize these events is unaffected, and notices only send when `resolveRecipient` + a bus are wired.
- 1d7e917: Phase 4: first-party subscription cancel & reactivate
  
  Two new session-authenticated routes give customers self-serve cancellation without the hosted billing portal:
  
  - **`POST /billing/subscription/cancel`** — `atPeriodEnd` defaults to `true` (keep access until the paid-through date); `false` cancels immediately.
  - **`POST /billing/subscription/reactivate`** — un-cancel a subscription scheduled to cancel at period end (idempotent).
  
  New optional provider methods `IBillingProvider.cancelSubscription` / `reactivateSubscription` (Stripe implemented via `cancel_at_period_end` / `subscriptions.cancel`), returning `ISubscriptionChange`. When a provider doesn't implement them the routes answer `501` (the hosted portal remains a fallback).
  
  The controller performs the provider change and updates the stored subscription **optimistically** (so the next read reflects it), but deliberately emits **no events and no notices** — the provider webhook (`customer.subscription.updated`/`.deleted`) stays the single source of truth for the lifecycle event + the `billing.subscription-canceled` notice, so a cancellation is announced exactly once. Routes are behind `requireAuth` and the `withBilling` workspace-membership guard, so a caller can only act on their own subscription.
  
  This is the "cancel endpoint" from the capability audit. **Downgrade (scheduled plan-change) and dunning-grace remain out of scope** — downgrade needs Stripe subscription schedules and is deferred to a Phase 4b. Additive/opt-in.

## 6.1.0

### Minor Changes

- 5cce49d: Phase 2: billing communicates money events to the customer (governing principle: no money moves without a durable record AND a clear customer communication)
  
  `IBillingConfig` gains `resolveRecipient?(subscriberType, subscriberId)` (with
  the `IBillingRecipient` / `ResolveRecipient` types). Billing's money flows are
  webhook-driven and have no session, so the app maps a subscriber id to an
  email/phone/deviceToken; returning `null` (or omitting the resolver) sends
  nothing. When a recipient resolves and a `bus` is wired, billing emits
  courier's `NOTIFICATION_EVENT` for:
  
  - **pack-purchase receipt** — on a real (non-replay) wallet credit
    (`billing.payment-receipt`);
  - **failed-payment dunning** — on the transition into `past_due`
    (`billing.payment-failed`);
  - **cancellation** — on the transition into `canceled`
    (`billing.subscription-canceled`);
  - **low balance** — once per crossing, with recovery hysteresis, alongside a
    new `fonderie.billing.wallet.low_balance` domain event
    (`billing.credits-low`).
  
  Notices fire only on the state transition (not on every provider retry) and
  only on a real credit (not on an idempotent replay), so no customer is
  double-emailed. Message keys are exported as `MESSAGE_KEYS`; the operator
  supplies the courier templates, billing supplies the `type` + `data` payload.
  
  `BillingModule.checkReadiness()` now fails closed: when payments are enabled (a
  paid plan or the wallet) but no communication path is configured
  (`bus` + `resolveRecipient`), it raises a production **error** (a warning
  outside production), aggregated by `app.checkProductionReadiness()` and
  enforced at boot. Taking money with no way to inform the customer is a SOC 2
  Processing-Integrity / consumer-protection failure, not an integrator's later
  choice.
  
  Per-plan `IBillingPlanWallet.lowBalanceAt?: bigint` sets the low-balance
  threshold (omit to disable).
  
  Additive and opt-in: with no `bus`/`resolveRecipient`, billing behaves exactly
  as before (outside production). `@fonderie/events` remains an optional peer.
  Refund/chargeback notices (`billing.refund-processed`, declared but not yet
  emitted) and one-time-payment-declined notices need the normalized provider
  events from Phase 3.
- 63d1036: Phase 1: billing publishes `fonderie.billing.*` domain events on the EventBus
  
  `BillingModule` now accepts an optional `bus?: EventBus` (third constructor
  argument) and, when given one, publishes domain events at its money-movement
  points — subscription lifecycle (`subscription.created/updated/canceled/past_due`
  from the webhook), credit-pack purchases (`credit_pack.purchased` +
  `wallet.credited`), manual grants (`wallet.credited`), and periodic plan
  grants (`grant.applied` + `wallet.credited`). Event keys are exported as
  `EVENT_KEYS` / `BillingEventKey`.
  
  This closes the "billing emits nothing subscribable" gap from the billing
  capability audit: in-process consumers can now subscribe, and — because each
  workspace-scoped payload carries a top-level `workspaceId` — `@fonderie/webhooks`
  fans the same events out to a customer's own endpoints with no billing→webhooks
  coupling. Money amounts are serialized as strings (payloads are JSON: persisted
  and forwarded). Emission is fire-and-forget and skipped on idempotent replays,
  so a bus hiccup or a webhook retry never breaks billing or double-fires.
  
  Additive: `@fonderie/events` is an optional peer dependency; billing behaves
  exactly as before when no `bus` is provided. Customer-facing receipts/notices
  (courier `NOTIFICATION_EVENT`) and the refund/chargeback clawback are Phase 2/3.
- e89d5f6: Phase 3a: refund/chargeback wallet clawback — closes the value-leak where a buyer could purchase credits, spend them, then refund the card (or file a chargeback) and keep the goods
  
  The Stripe provider now normalizes `charge.refunded` and `charge.dispute.created` / `.closed` into a new `IBillingEvent.reversal` (`INormalizedReversal`), and the payment webhook reverses the credits the original purchase granted:
  
  - A refund/chargeback carries no wallet metadata, so billing joins back to the purchase by its PaymentIntent (`provider_tx_id`, now indexed via migration `007`). New helpers: `reverseWallet`, `findPurchaseByProviderTxId`, `sumReversedCreditsByProviderTxId`, `findLedgerAmountByKey`.
  - The reversal is a negative `type:'refund'` ledger row that **deliberately bypasses the balance floor** — a clawback must be able to drive the wallet negative when the credits were already spent (a negative balance is "credits owed back"; the next grant/purchase nets against it).
  - Credits are prorated to the refunded amount and the **cumulative reversal is capped at the credits granted, enforced inside the transaction under a per-PaymentIntent advisory lock**, so no mix of partial refunds and a chargeback — even delivered concurrently — can ever over-reverse.
  - Idempotent on the refund's/dispute's own id (a charge can be partially refunded many times, each distinct). A won dispute restores exactly what its chargeback clawed.
  - Emits `fonderie.billing.payment.refunded` + `fonderie.billing.wallet.debited` and the (previously reserved) `billing.refund-processed` customer notice — only on a real, non-replayed reversal.
  
  `SubscriptionStatus` is widened to the full provider vocabulary (adds `incomplete_expired`, `unpaid`) — the DB column is already free-form text, so this only makes the type honest; the new states are inactive by default.
  
  Additive and opt-in: the new event slot and helpers don't affect existing flows, and refunds only act when the provider normalizes them. Proven against real PostgreSQL (negative-balance clawback, idempotent replay, and the concurrent dispute+refund cap). The remaining Phase 3 items — `invoice.paid`/`invoice.payment_failed` and `checkout.session.async_payment_failed`/`payment_intent.payment_failed` normalization (notification-only) — land in a follow-up.

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
