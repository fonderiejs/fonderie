---
'@fonderie/billing': major
---

Stored-value wallet: ledger-backed credits, credit packs, and plan rates

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
and a nullable `wallet` JSONB column on `fonderie_plans`. Subscription-only
consumers that leave `config.wallet` unset see no behavior change beyond
the `bigint` config literals.
