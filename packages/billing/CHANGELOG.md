# @fonderie/billing

## 9.0.1

### Patch Changes

- 444f316: Manager gates match role NAMES, not just `is_system` (closes a hole in the just-shipped RBAC gates). Both `ADMIN` and `GUEST` are seeded system roles, and every default invitation lands on `GUEST` — so "holder of any active system role" made every default-invited member a manager, defeating the gate. `requireManager` (workspaces) and `requireBillingManager`/`isWorkspaceManager` (billing) now accept the workspace owner or a holder of an active **system role whose name is in the manager list** — default `['ADMIN']`, configurable via the new `managerRoles` config option in both packages. The `is_system` restriction remains (a member-created local role named 'ADMIN' still grants nothing).

## 9.0.0

### Major Changes

- cd2706a: Money-mutating billing routes now require a workspace manager (BREAKING for workspace-scoped billing). `withBilling` verifies *membership*, so any member could spend the workspace's saved card, start checkouts, buy wallet credits, change auto-recharge preferences, or cancel the subscription. Checkout, portal, subscription cancel/reactivate, payment-method setup/save/remove, and wallet checkout/purchase/preferences now additionally require the caller to be the workspace **owner** or hold an **active system role**, via the new exported `requireBillingManager` middleware (fail-closed, same cross-module data-dependency pattern as the existing membership check). Reads (subscription, invoices, wallet, usage) and usage recording are unchanged, and **user-scoped billing is never gated** — a user always manages their own money. Restore the legacy behaviour with `management: 'any-member'` in the billing config.

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 8.12.1

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 8.12.0

### Minor Changes

- 4eff0f5: Idempotent subscription checkout. `POST /billing/checkout` now accepts an optional `idempotencyKey` (added to `checkoutSchema` so `validate` doesn't strip it, threaded into `StripeProvider.createCheckoutSession` as the Stripe idempotency key). `@fonderie/client`'s `ICheckoutInput` gains the field, and `@fonderie/react-billing`'s `useCheckout` generates a V4 UUID per attempt (mirroring `usePurchasePack`) — so a retried checkout dedupes to a single session (and one subscription) instead of a duplicate. Verified: same key → same Stripe session; different key → different session.

### Patch Changes

- ec1105c: Fix: `GET /billing/invoices` now unions invoices across all of a subscriber's provider customers, not just one. A pay-as-you-go buyer gets a wallet customer from their first credit-pack purchase, and a later subscription checkout can resolve/create its own customer — splitting invoices across two Stripe customers. `listInvoices` previously queried only the wallet customer (via `resolveCustomer`), so subscription invoices were invisible. It now gathers the wallet customer and the subscription customer, queries each, and merges (deduped by id, newest first) so pack and subscription invoices appear together.

## 8.11.1

### Patch Changes

- ad8c072: `IInvoiceDTO` now carries `dueDate` (ISO-8601, or null). `GET /billing/invoices` surfaces each invoice's payment-terms due date from the provider (`StripeProvider` maps `invoice.due_date`); one-time charges are paid on capture and carry `null`. Lets a billing UI show a "Due" column alongside the payment date.

## 8.11.0

### Minor Changes

- 63164d2: In-app pack purchases can now bill the saved card through a real Stripe **invoice** instead of a bare charge, so the buyer gets a proper invoice — number + downloadable PDF + hosted page — alongside the card receipt (Anthropic-style). New optional `IBillingProvider.chargeViaInvoice` (implemented by `StripeProvider`: create → line item → finalize → pay off-session, currency pinned to the charge currency, idempotent per step, finalized-but-unpaid invoices voided, SCA/decline resolved to a status). `purchasePackWithSavedCard` prefers it when available and falls back to `chargeOffSession` (receipt only) otherwise; the wallet credit stays idempotent on the invoice's PaymentIntent, and the invoice surfaces automatically through `listInvoices`. An `invoice.paid` webhook heals an orphaned capture (client dropped after an indeterminate pay) via the shared `applyPackCredit`, keyed on the same PaymentIntent so it credits exactly once. No change to the refund-clawback or hosted-checkout paths.

## 8.10.0

### Minor Changes

- 41bed09: `GET /billing/invoices` now includes one-time payments, not just subscription invoices. A credit-pack purchase is a bare Stripe PaymentIntent/Charge, never a Stripe Invoice, so `stripe.invoices.list` never returned it — the money showed in Stripe but the buyer had no record of it in-app. `StripeProvider.listInvoices` now also lists the customer's one-time charges (those not tied to a subscription invoice, and captured), mapped to the same summary shape with the Stripe-hosted **receipt URL** as `hostedInvoiceUrl`, merged newest-first with subscription invoices. Subscription-invoice charges are excluded (`charge.invoice != null`) so nothing double-counts.

## 8.9.0

### Minor Changes

- 4fa0ef3: Add an in-app credit-pack purchase that charges the subscriber's saved card instead of redirecting to hosted checkout. New route `POST /billing/wallet/purchase` ({ packId, idempotencyKey }): it charges the card on file via the provider's off-session PaymentIntent and credits the wallet, so a buyer with a saved card never leaves the site.
  
  Money-safety mirrors the audited auto-recharge path: the charge is idempotent on a subscriber-namespaced client key (a double-submit or a retry after an indeterminate response dedupes to the same PaymentIntent), and the wallet credit is idempotent on the resulting charge id (no double-credit; proven on Postgres). Outcomes are returned as a status, not a throw — `credited`, `checkout_required` (no saved card, or the card needs 3-D Secure → the caller falls back to hosted checkout, which authenticates in-flow), `declined`, or `processing` (indeterminate — retry with the same key, never a new hosted payment, so it can't double-charge). The credit records `providerTxId`/`amountPaid`/`paymentCurrency`/`packId` so a later refund or chargeback prorates the clawback exactly as the hosted-checkout path does, and respects the `blockPacksWhileSubscribed` (GAP-1) policy.
  
  A `payment_intent.succeeded` webhook safety-net credits an orphaned purchase (client dropped after an indeterminate charge) exactly once — gated to `metadata.reason==='purchase'` and keyed on the PaymentIntent id, so it dedupes with the synchronous credit and never touches hosted-checkout or auto-recharge PaymentIntents. A synchronously-declined in-app purchase no longer also sends a `payment_intent.payment_failed` email (the interactive caller owns the decline UX).

## 8.8.0

### Minor Changes

- ddf0f9c: Make the in-app card-save SetupIntent's offered payment methods configurable, defaulting to card only. `StripeProvider` takes a new optional third argument `{ setupPaymentMethodTypes }` (typed via the exported `SUPPORTED_PAYMENT_OPTIONS` const / `SupportedPaymentOption` union), and `createSetupIntent` uses it instead of `automatic_payment_methods`.
  
  This fixes a bug where a subscriber whose email Stripe recognized for **Link** would save a `type:'link'` payment method — which has no `card` object, so `getPaymentMethod` couldn't render or read it back, and the card appeared lost on refresh. The default `[SUPPORTED_PAYMENT_OPTIONS.CARD]` guarantees a concrete, displayable, off-session-chargeable card that stays on-page. Consumers who want wallets can opt in (e.g. `[SUPPORTED_PAYMENT_OPTIONS.CARD, SUPPORTED_PAYMENT_OPTIONS.LINK]`), accepting that non-card methods won't display as a card on file. The policy lives in the consumer's provider config, not hard-coded in the brick.

## 8.7.2

### Patch Changes

- 113c586: Documentation: cover in-app payment-method management. The `@fonderie/billing` README gains a *Payment methods* section (routes, the on-page SetupIntent flow, the optional provider methods with their `501` fallback, ownership checks, and `allow_redirects: 'never'`); the hook/composable READMEs list `usePaymentMethod`/`useSetupPaymentMethod`/`useSavePaymentMethod`/`useRemovePaymentMethod` with a short in-app example; and the screens READMEs document `SubscriptionScreen`'s payment-method section and its add/update delegation (`onAddPaymentMethod` prop / `add-payment-method` emit). Docs-only — no runtime change.

## 8.7.1

### Patch Changes

- c967bc8: `createSetupIntent` now sets `automatic_payment_methods.allow_redirects: 'never'` so in-app card entry stays on-page: the embedded Payment Element only offers methods that need no off-site redirect (cards/wallets), which is also exactly what an off-session-chargeable saved card must be. Without it a redirect-based method could bounce the user off the site on confirm — contrary to the in-app design.

## 8.7.0

### Minor Changes

- e548235: Add in-app payment-method management so a card can be added, replaced, and removed without leaving the site (no hosted-checkout redirect / billing portal):
  
  - `POST /billing/payment-method/setup` → returns a SetupIntent `clientSecret` for the provider's embedded card element (Stripe Payment Element). Ensures a provider customer first, creating + recording one for a pay-as-you-go user who has never purchased.
  - `PUT /billing/payment-method` `{ paymentMethodId }` → after the client confirms the SetupIntent, makes the card the customer's default and records the consented card. The provider verifies the card is attached to THIS customer and rejects otherwise (`INVALID_PAYMENT_METHOD`).
  - `DELETE /billing/payment-method` → detaches the card from the customer and clears the stored record.
  
  New optional `IBillingProvider` methods (implemented by `StripeProvider`): `createSetupIntent`, `setDefaultPaymentMethod` (ownership-checked), `detachPaymentMethod` (ownership-checked). Absent-provider routes answer 501. No breaking changes; no new tables.

## 8.6.0

### Minor Changes

- 1d08c2f: Close two subscription-lifecycle vulnerabilities found in a follow-up audit (both medium; each ships with a regression test, engine claims proven on the PG suite):
  
  - **Optimistic reactivate/cancel could resurrect a terminally-canceled subscription.** The `provider_event_at` ordering guard intentionally exempts non-webhook writes (they carry a null token), so a reactivate or at-period-end cancel still in flight when a terminal `customer.subscription.deleted` webhook lands would rewrite the row back to active/paid — with no later webhook to correct it (deleted is terminal), leaving the subscriber with unbilled paid access. Those optimistic writes now pass `guardNotWebhookCanceled`, so the update no-ops over a webhook-canceled row and the controller reports the truthful terminal state (409 for reactivate, already-canceled for cancel) instead of a phantom success.
  - **Unlimited free trials via cancel → resubscribe.** A canceled subscription row is overwritten on resubscribe, so it couldn't remember a trial had been used; checkout re-applied `plan.trialDays` every cycle (and, since trialing is grant-eligible, handed out a fresh wallet grant each period). A new durable `fonderie_subscription_trials` ledger records a consumed trial once (written by the subscription webhook when a subscription enters a trial); checkout now grants `trialDays` only to a subscriber who has never trialed.
  
  No breaking changes; one additive table applied on boot (`fonderie_subscription_trials`).

## 8.5.0

### Minor Changes

- 4eca86c: Harden the wallet + subscription money paths against provider webhook races and mis-attribution (5 audit findings; no breaking changes, two additive nullable columns applied on boot):
  
  - **Refund-before-credit clawback drop.** Pack charges now carry their own metadata (via `payment_intent_data.metadata`), and a refund/chargeback that arrives before its purchase credit returns a retryable `CLAWBACK_DEFERRED` instead of being silently ignored — so the provider re-delivers and the clawback lands once the credit exists.
  - **Subscription webhook ordering race.** `customer.subscription.*` events are at-least-once and unordered; a retried/out-of-order event could resurrect a canceled or downgraded subscription. The provider event timestamp (`event.created`, exposed as `IBillingEvent.eventAt`) is now stored as `provider_event_at` and the upsert no-ops any event older than the one already applied. A rejected stale event also fires no lifecycle domain event or customer notice, closing the event-bus twin of the same bug.
  - **Checkout orphaning a paused/unpaid subscription.** `paused` and `unpaid` subscriptions still exist at the provider; a plan change now refuses them with clear guidance (`SUBSCRIPTION_PAST_DUE` / `SUBSCRIPTION_PAUSED`) instead of opening a fresh checkout that nulls the live `provider_subscription_id`.
  - **Auto-recharge idempotency key past its TTL.** A pending idempotency key aged past the provider's retention (~24h) no longer dedupes; reusing it would double-charge. The claim now records when the key was minted (`pending_recharge_key_at`) and, once it is stale, stops rather than charging — disabling auto-recharge and surfacing the stuck charge for reconciliation (a new purchase re-arms it).
  - **Admin grant currency.** A manual grant with no explicit currency now targets the subscriber's plan-wallet currency (the bucket they actually spend from), not the global default — so credits are no longer stranded in an unspendable bucket for non-default-currency plans.

## 8.4.0

### Minor Changes

- 65512e7: Declare `stripe` as an **optional `peerDependency`** (`>=17`) instead of an `optionalDependencies`. This matches Fonderie's provider-injection model — the consumer instantiates `StripeProvider`, so the consumer owns the Stripe SDK: one `stripe` copy at the version the app chooses, and consumers on a non-Stripe `IBillingProvider` no longer pull `stripe` in transitively.
  
  `StripeProvider` already loads `stripe` via a lazy dynamic `import()` (pinned to Stripe API `2024-11-20.acacia`), so nothing in `@fonderie/billing` needs it at build time. If you use `StripeProvider`, add `stripe` to your app (`npm install stripe`) — the provider already throws a clear "stripe is required: npm install stripe" if it's missing. Apps that already depend on `stripe` directly need no change.

## 8.3.0

### Minor Changes

- 02fa3cc: Add `config.wallet.blockPacksWhileSubscribed` (default `false`). When enabled, `POST /billing/wallet/checkout` is rejected with `409 PACKS_BLOCKED` for a subscriber on an **active or trialing paid plan** — a paid plan already includes its credits, so selling one-time packs on top would charge for something the subscription covers.
  
  Declarative config, not a hook. Off by default, so the allowance + top-up shape is unchanged. Free / pay-as-you-go / unpriced plans are never blocked (a plan with no `monthly` or `yearly` price is treated as free), and a `past_due` subscriber is not blocked (they may top up while payment is retried).

## 8.2.0

### Minor Changes

- 7cacd67: Add `config.wallet.blockPacksWhileSubscribed` (default `false`). When enabled, `POST /billing/wallet/checkout` is rejected with `409 PACKS_BLOCKED` for a subscriber on an **active or trialing paid plan** — a paid plan already includes its credits, so selling one-time packs on top would charge for something the subscription covers.
  
  Declarative config, not a hook. Off by default, so the allowance + top-up shape is unchanged. Free / pay-as-you-go / unpriced plans are never blocked (a plan with no `monthly` or `yearly` price is treated as free), and a `past_due` subscriber is not blocked (they may top up while payment is retried).

## 8.1.0

### Minor Changes

- d08ff1a: Add read-only billing-account endpoints for in-app billing pages: `GET /billing/payment-method` (the customer's card on file — brand/last4/expiry) and `GET /billing/invoices` (invoice history, each linking out to the provider-hosted invoice). Both resolve the provider customer from the wallet customer first (so pay-as-you-go users with no subscription still see their card) then the subscription.
  
  Backed by two new optional `IBillingProvider` methods — `getPaymentMethod` and `listInvoices` — implemented by `StripeProvider`. They follow the existing optional-capability convention: when a provider implements neither, the routes answer `501`, so this is additive and non-breaking for existing providers. Adds `IPaymentMethodDTO`/`IInvoiceDTO` (+ `toPaymentMethodDTO`/`toInvoiceDTO`) and the `INormalizedCard`/`INormalizedInvoiceSummary` provider types.

## 8.0.0

### Major Changes

- 04f74b2: Default templates for every billing notification + a small emitter change so money renders (P3 of the notification-template normalization).
  
  **Feature (additive):** `@fonderie/billing` now exports `DEFAULT_TEMPLATES` covering all its notification keys — `subscription-canceled`, `payment-failed`, `trial-ending`, `renewal-receipt`, `limit-warning`, `limit-reached`, `credits-low`, `payment-receipt`, `refund-processed`, `auto-recharge-failed`. Pass to courier via `config.templates.defaults` and billing's emails render out of the box — the four wallet notices (`credits-low`, `payment-receipt`, `refund-processed`, `auto-recharge-failed`) that previously fell to a raw-JSON dump now render real copy. Override any key per-app with a DB row / FS file. Copy is brand-neutral and "balance"-centric (fits a money- or credit-denominated wallet). `satisfies Record<BillingMessageKey, IDefaultTemplate>` makes a missing key a compile error; a coverage test proves each renders cleanly with its real payload.
  
  Because courier's `render()` can't format, three money/credit notices now carry pre-formatted `*Display` fields computed at emit by a new `formatWalletAmount(amount, currency, precision)` helper: `credits-low` (`balanceDisplay`, `thresholdDisplay`), `payment-receipt` and `refund-processed` (`creditsDisplay`, `balanceAfterDisplay`). Additive to the notification payload only — no change to any credit/debit/balance/idempotency logic.
  
  **Breaking:** removed the dead `MESSAGE_KEYS.limitBlocked` (`'billing.limit-blocked'`) — it was never emitted (a hard limit block returns 429 directly), so no notification ever used it, but it was a public member of `MESSAGE_KEYS`. Any code referencing `MESSAGE_KEYS.limitBlocked` (a courier channels entry or template for it — necessarily dead, since it never fired) should drop that reference.
  
  Requires `@fonderie/core >= 0.8.0` + `@fonderie/courier >= 5.2.0`.

## 7.2.2

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 7.2.1

### Patch Changes

- f3656f8: Consolidate three cross-package duplications into shared @fonderie/core primitives (from the consolidation audit).
  
  - **`constantTimeEqual(a, b)`** (new core export) — the one timing-safe compare. Replaces byte-identical copies in auth (MFA/TOTP codes), events (event-log HMAC), courier (SendGrid/Mailgun webhook-signature verification), and core's own admin-token guard. Prevents any copy silently dropping the length-guard or swapping to `===` and reintroducing a per-module timing side-channel.
  - **`secretStrengthProblem` / `PLACEHOLDER_SECRET` / `MIN_SECRET_LENGTH`** (new core exports) — one weak/placeholder-secret denylist. auth's `jwtSecret`/`clientSecret` checks and core's `validateAdminToken` now share it (the two regexes had already drifted by one term). Call-site policy (required vs optional, field name) stays per-module.
  - **`encodeKeysetCursor` / `decodeKeysetCursor`** (new core exports) — one keyset-pagination cursor over `(created_at, id)`. billing's wallet ledger and audit's event log now share it. **Fixes a real bug in `@fonderie/audit`**: its local decode lacked timestamp field-range checks, so a crafted in-shape-but-out-of-range cursor reached the `::timestamptz` cast as a **500**; it now decodes to null (the model drops the keyset predicate and returns the first page) instead of 500ing. audit's opaque cursor wire format changes to the shared one (in-flight cursors restart pagination — acceptable for an opaque cursor).
  
  Behavior-preserving elsewhere (billing's public `encode/decodeLedgerCursor` are kept as aliases; auth also adopts the existing `dateOrEmpty` for session/user timestamps, fixing a latent `''`-for-string-input inconsistency). Adversarially reviewed; no public API removed.
- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 7.2.0

### Minor Changes

- 0f0ca59: Unify admin-route authentication into one shared primitive (see docs/ADMIN-AUTH-SPEC.md).
  
  Every module with an ops/admin surface (billing plan-writes + wallet-grant, config/secrets admin, courier template admin) previously shipped its own hand-rolled Bearer guard — three byte-identical copies of `safeTokenEqual` + the guard, with no guarantee they stayed in sync.
  
  - **`@fonderie/core`** now exports `requireAdminToken(adminToken)` and `validateAdminToken(token, { module })` from `@fonderie/core/middlewares` — the one constant-time Bearer guard and the one admin-token strength rule (min 32 chars, reject placeholders). Core depends on nothing, so there is no cycle.
  - **`@fonderie/billing`** and **`@fonderie/courier`** delete their local guard copies and adopt the shared one, and — the real fix — now call `validateAdminToken` in `checkReadiness()`, so a weak/placeholder admin token guarding `/plans` + `/billing/wallet/grant` or `/admin/templates` is a **production readiness error** (previously only `@fonderie/config` enforced this; billing/courier accepted a `changeme` token).
  - **`@fonderie/config`** drops its duplicate guard + strength logic for the shared core versions — behavior-identical, no observable change.
  
  No route paths, methods, request/response shapes, or config fields change. `requireAdminToken` behavior (Bearer, constant-time, `401 UNAUTHORIZED / "Missing or invalid admin token"`) is preserved exactly.

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 7.1.0

### Minor Changes

- af0e82c: Unified admin token + per-type notification toggles (both additive, non-breaking).
  
  **One admin token for all billing ops routes.** New top-level `config.adminToken` guards *both* the DB-plan write API (`POST/PUT/DELETE /plans`) and the wallet manual-grant (`POST /billing/wallet/grant`), each still registered only when a token is available (unset ⇒ 404). The per-surface tokens `config.planAdminToken` and `config.wallet.adminToken` are now **deprecated** but still honored as fallbacks (`config.adminToken ?? <legacy>`), so existing configs keep working — set `config.adminToken` going forward. A plan token never cross-enables the wallet-grant route (and vice versa).
  
  **Opt out of the informational emails.** `IBillingNotificationsConfig` gains `creditsLow?` and `trialEnding?` (both default on). Setting either to `false` suppresses that customer EMAIL while the durable domain event still fires. The mandatory money-movement notices (payment receipt, renewal receipt, refund, failed payment) and account-state notices (cancellation, auto-recharge failure) remain unconditional — there is deliberately no toggle for them, per the governing principle.

## 7.0.0

### Major Changes

- 49eeef0: Security hardening (from the 2026-09-05 audit). The money core was found sound; these close pre-existing peripheral gaps in the base module.
  
  **BREAKING — DB-plan write API is now admin-token-gated.** `POST/PUT/DELETE /plans` were registered unauthenticated (any caller could edit/delete the persisted plan catalog — defacement/availability; no charge impact, since runtime billing reads `config.plans` in memory, not this table). They are now registered **only when the new `config.planAdminToken` is set**, each guarded by `requireAdminToken` (constant-time), exactly like `POST /billing/wallet/grant`. `GET /plans` and `GET /plans/:planId` stay public.
  
  *Migration:* if you manage plans via these routes, set `config.planAdminToken` and send it as the admin bearer token; otherwise the write routes return 404 (they are not registered). Consumers that define plans via `config.plans` (the common case) are unaffected.
  
  Also hardened (non-breaking):
  - **Ledger cursor** — the pagination cursor's timestamp is now range-checked, so a crafted in-shape-but-out-of-range value returns `422` instead of a Postgres cast `500`.
  - **Plan id** — a non-UUID `:planId` on `GET/PUT/DELETE /plans/:planId` returns `404` (get) / no-op (update/delete) instead of a `22P02` `500`; `getDBPlans` is capped at 500 rows.
  - **Rate-limit notices** — the module-level dedup Set now clears a counter's markers when it returns below its threshold (bounded memory; a later re-crossing notifies again), mirroring the existing low-balance hysteresis.
  
  Adversarially reviewed; verified against real PostgreSQL.

## 6.5.0

### Minor Changes

- 4e3991f: Phase 5b: spend-purchased toggle — end-to-end API + hooks
  
  The Phase 5a spend-purchased preference (whether a debit may draw down purchased credits once the free allowance is exhausted) is now settable end to end, not just enforced from the database.
  
  - **Server** — new `POST /billing/wallet/preferences` (requireAuth, `walletPreferencesSchema`): `wallet.setPreferences` writes the per-(subscriber, currency) flag via a new `setSpendPurchased` service (UPSERT — creates a zero-balance row if none exists) and returns the refreshed wallet, currency-scoped like `GET /billing/wallet`.
  - **Client** — `BillingClient.getWallet()` and `BillingClient.setWalletPreferences({ spendPurchased })` (with `IWalletDTO` / `IWalletResult` / `IWalletPreferencesInput`) — the first typed wallet surface in `@fonderie/client`.
  - **Hooks** — `useWalletPreferences()` in `@fonderie/react-billing` and `@fonderie/vue-billing` (read current value + `setSpendPurchased(bool)`, refresh-on-mount); carried into `@fonderie/react-native-billing` via its wholesale re-export.
  
  Additive/opt-in. Verified against real PostgreSQL (UPSERT on a no-row subscriber; toggle flips the debit hard-stop end to end) plus client/react/vue tests; adversarially reviewed. Wallet balance/transactions client+hooks remain a later cycle (still allow-listed).

## 6.4.0

### Minor Changes

- 71fe0e1: Phase 5a: allowance vs purchased credit buckets (founder-selectable hybrid monetization)
  
  The wallet now distinguishes a non-stackable subscription **allowance** from a stacking **purchased** balance, so a plan can include monthly credits *and* sell top-ups without the two commingling. `amount` keeps its exact meaning (total spendable); a new `granted_amount` (+ `granted_period`, `granted_expires_at`) tracks the allowance, and `purchased = amount − granted`. Migration `010`; new `expiry` ledger type.
  
  - **Allowance-first debit** — a debit draws the free allowance before purchased credits (one atomic, floor-checked statement).
  - **Allowance expires, purchased persists** — unspent granted credits expire at period end per a new per-plan `IBillingPlanWallet.grantRollover` (`'none'` default = use-it-or-lose-it, `'full'`, or `{ cap }`); the expiry is settled before any spend so stale allowance is never spendable. Purchased credits carry over indefinitely.
  - **Refund confined to purchased** — a refund/chargeback clawback (`reverseWallet`) touches the total/purchased only and can never consume the granted allowance.
  - **Spend-purchased toggle** — a new per-subscriber `spend_purchased` flag (default true); when false, a debit is refused (402) once the allowance is exhausted, so a paid balance is never drained unless the user opts in.
  - **Backward compatible** — existing single-balance wallets classify wholly as purchased (nothing already held ever expires); pure wallet-only and subscription-only behavior is unchanged. `getWalletBalance` and the wallet DTO gain optional `granted`/`purchased`/`spendPurchased`/`grantedExpiresAt`. `checkReadiness()` flags an allowance configured without a wallet and a negative rollover cap. New exports `settleAllowance`, `startOfNextPeriod`.
  
  Additive/opt-in throughout. Verified against real PostgreSQL (allowance-first, expiry none/full/cap, toggle hard-stop, refund-purchased-only, overdraft-eats-purchased, legacy-balance-is-purchased) and adversarially reviewed. The per-subscriber toggle's HTTP setter + client/hooks follow in 5b.

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
