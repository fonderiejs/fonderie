# Billing Capability Audit — Event Coverage, Communication Integrity & Payment Readiness

> **STATUS: OPEN (2026-09-05).** Findings below are verified against `main`
> (`@fonderie/billing` post-wallet) by a multi-agent read of the actual code;
> the four load-bearing claims were each re-checked by two independent
> reviewers (all upheld 2/2). Every finding carries `file:line` evidence.
> This is a working document: check items off as they land, extend it, don't
> fork it (same convention as `HOOK-GAP-AUDIT.md` and `DTO-GAP-AUDIT.md`).

## Why this audit exists

The question that triggered it: *"a user makes a purchase, gets a refund, or
has a transaction denied — how do we communicate that, and can this back a
credit-based SaaS or a payment app?"* Tracing the code produced an
uncomfortable answer for the money-movement paths, and a load-bearing
principle the platform must adopt before it can be sold into regulated or
enterprise contexts.

## Governing principle — Communication & Record Integrity

> **No money movement ships without a durable record *and* a clear
> communication to the payer. This is enforced at boot, not left to the
> integrator's memory.**

This is not a product nicety; it is a control requirement:

- **Consumer-protection & tax law.** Across most jurisdictions a paid
  transaction must produce a receipt/record the customer can retain, and the
  merchant must retain transaction records for statutory periods (commonly
  6–7 years). A refund or a declined/again-charged transaction likewise owes
  the customer a clear, timely notice.
- **SOC 2 Processing Integrity (Trust Services Criteria PI-series).** System
  processing must be complete, valid, accurate, timely, and **authorized**,
  and outputs (here: the confirmation/receipt of a money event) must be
  delivered to the right party. A payment path that can silently send nothing
  is a Processing-Integrity finding, not a UX gap.
- **SOC 2 Common Criteria / monitoring.** The append-only ledger is already
  the system of record; the missing half is the *communication and outbound
  event* that lets both the customer and downstream/monitoring systems
  observe that a controlled financial event occurred.

**The invariant this audit drives toward:** for every money event
(purchase, grant, refund, chargeback, declined/failed charge), billing emits
(1) a durable **domain event** on the bus, and (2) a **customer
communication** — and if the communication path is not wired while payments
are enabled, `BillingModule.checkReadiness()` raises it as a
production-level error. Fail loud, never fail silent.

> **Baseline caveat (accuracy, not an excuse):** the payment provider
> (Stripe) typically sends the *card* receipt (brand, last4, amount, tax,
> invoice PDF) when configured. That is the transactional/legal receipt
> baseline. It cannot express the *app-specific* outcome ("you now hold 5,000
> credits", "your access was restored/suspended"), and relying on an
> out-of-band dashboard toggle is not a control. The framework owns the
> app-layer confirmation and must not assume the provider's receipt is on.

---

## Verdicts

| Target | Verdict | One-line |
|---|---|---|
| **Credit-based SaaS** | ✅ Buildable today | Full fund→meter→read→block loop present and money-safe; must-fix gaps below (clawback, low-balance, communication). |
| **Payment app** (PayPal/Connect-style) | ❌ Not without substantial new work | Single-custodial stored-value ledger; no transfers, payouts, refunds-to-payer, disputes, escrow, KYC, fee-split, reconciliation. Deliberately scoped out of the money-transmitter boundary. |
| **Subscribable event coverage** | ❌ Insufficient | Provider webhook coverage is money-in-only; billing emits **zero** internal bus events. |
| **Communication integrity** | ❌ **Failing** | Purchase / refund / declined all send the customer nothing; billing has no path to courier. |

---

## How communication actually works in this framework (and why billing can't)

Courier is a pure bus subscriber: `courier/module.ts:38` registers
`bus.on(NOTIFICATION_EVENT, msg => dispatcher.dispatch(msg))`. The **only**
way to send an email/SMS/push is to `bus.emit('fonderie.notification.send',
<ICourierMessage>)`. Auth and workspaces do this at their action points.

`@fonderie/webhooks` fans domain events out to a customer's own HTTP
endpoints, keyed on a top-level `workspaceId` in the payload
(`webhooks/dispatcher.ts:25`).

**Billing does neither.** It does not depend on `@fonderie/events` at all
(`packages/billing/package.json` lists only `zod`), defines no `EVENT_KEYS`,
and never calls `.emit()`. Its sole courier-adjacent code pushes rate-limit
warnings into `ctx.meta['messages']` (`middlewares/billing.ts:171`) — a bag
**no framework code drains**, and one that is request-scoped so it is
unavailable on the unauthenticated webhook path anyway. Net result for the
three money flows:

| Flow | Code today | Customer told? | Record/clawback? |
|---|---|---|---|
| Purchase succeeds | `payment-webhook.controller` credits wallet, returns `{received:true}` | **No** | Ledger row ✅ / no event |
| Refund | `charge.refunded` not normalized by `constructEvent` → ignored | **No** | **No clawback** |
| Transaction denied | `async_payment_failed` / `payment_intent.payment_failed` / `invoice.payment_failed` unhandled | **No** | No record |

---

## Findings

Legend — need level per target: **R** required · **N** nice-to-have · **–** n/a.

### A. Communication & outbound-event integrity (headline)

- [ ] **Billing emits no domain events on the EventBus.** *(credit-SaaS: R, payment: R)*
  No `@fonderie/events` dependency; no `EVENT_KEYS`; zero `.emit()`
  (`packages/billing/package.json:88` = zod only). Consequence: nothing is
  subscribable in-process, and `@fonderie/webhooks` can forward nothing about
  billing to a customer's endpoints. Verified 2/2.
- [ ] **Purchase success sends no confirmation.** *(R, R)*
  `payment-webhook.controller.ts:41-42` credits and returns; no
  `NOTIFICATION_EVENT`, no `ctx.meta`. Violates the governing principle.
- [ ] **Refund sends no notice and reverses no credits.** *(R, R)* See §C.
- [ ] **Declined/failed transaction sends no notice.** *(R, R)* See §B.
- [ ] **No wallet low-balance signal.** *(R, N)*
  A wallet at/near zero notifies nothing; the customer discovers it as a 402
  at debit time. (`warnAt` in `middlewares/billing.ts` is for rate-limit
  counters, not wallet balance.)

### B. Provider (webhook) event coverage

Handled today (`providers/stripe.ts:305-334`): `checkout.session.completed`,
`checkout.session.async_payment_succeeded`,
`customer.subscription.{created,updated,deleted}`. Everything else falls
through as an ignorable passthrough. Verified 2/2.

- [ ] **`invoice.payment_failed` — no dunning.** *(R, R)* No retry/grace
  signalling, no "update your card". A failed renewal only surfaces
  indirectly as a later `subscription.updated status=past_due`.
- [ ] **`invoice.paid` — no renewal receipt.** *(N, R)*
- [ ] **`checkout.session.async_payment_failed` — delayed-method purchase
  never reconciled.** *(R, R)* ACH/SEPA/voucher pack purchases complete
  "unpaid" (`payment-webhook.controller.ts:61-68` returns pending); if the
  debit later fails, nothing fires.
- [ ] **`charge.refunded` — unhandled.** *(R, R)* See §C (exploitable).
- [ ] **`charge.dispute.created/.closed` — unhandled.** *(R, R)* No hold, no
  clawback, no suspension on chargeback.
- [ ] **`payment_intent.payment_failed` — unhandled.** *(N, R)*
- [ ] **`customer.subscription.trial_will_end` — unhandled.** *(N, N)*
- [ ] **Fraud (`radar.*` / `review.*` / early-fraud-warning) — unhandled.** *(N, R)*
- [ ] **`IBillingEvent` cannot carry these — structural blocker.** *(R, R)*
  `providers/types.ts` `IBillingEvent` is only `{ type, subscription?,
  payment? }`; both webhook controllers branch solely on those. Any refund /
  dispute / invoice event needs `IBillingEvent` extended first — this gates
  every item in §B and the §C clawback.

### C. Financial-integrity gaps (matter even for a pure credit SaaS)

- [ ] **Refund/chargeback credit clawback is missing — exploitable
  value-leak.** *(R, R)* The `'refund'` ledger type exists
  (`migrations/sql/006_wallet.sql:39`) but has **zero producers** — reachable
  only via a manual `creditWallet`. A refund issued from the dashboard for a
  pack purchase does **not** remove credits already granted or spent: *buy
  pack → spend credits → refund → keep the value*. Needs
  `charge.refunded`/`dispute` → wallet debit/reversal keyed off
  `provider_tx_id`. Verified 2/2.
- [ ] **Delayed-payment failure unreconciled.** *(R, R)* See §B
  `async_payment_failed`.

### D. Credit-based SaaS completeness

Present and money-safe (evidence): three funding paths — periodic plan
grants (`services/wallet.ts` `ensurePeriodicGrant` + `middlewares/billing.ts`),
admin grant route (`routes.ts`), pack checkout + dedicated payment webhook
with its own secret; atomic idempotent debit (`FOR UPDATE` + conditional
floor); per-metric rates + `requireWalletBalance` + `debitWalletForMetric`;
balance + keyset-paginated history; overdraft/block-at-zero. **A credit SaaS
can be built today.**

Remaining gaps:
- [ ] **Low-balance threshold + signal.** *(R, R)* (also §A)
- [ ] **Refund/reversal product path.** *(N, R)* Primitive exists; no HTTP
  surface and no provider-driven reversal (see §C).
- [ ] **Credit expiry / lot accounting.** *(N, N)* Credits never expire;
  unused monthly grants roll over indefinitely. No use-it-or-lose-it.
- [ ] **Multi-currency at runtime.** *(N, R)* Storage is per-`(subscriber,
  currency)`, but grants/spends/reads run one plan currency; no FX, no
  cross-bucket path.

### E. Payment-app structural gaps (all absent; money-transmitter boundary)

- [ ] Peer-to-peer transfers between subscribers *(–, R)* — cannot be faked
  as debit(A)+credit(B): the wallet transaction contract
  (`services/wallet.ts:22-26`) forbids nesting, so it wouldn't be atomic.
- [ ] Payouts / withdrawals to external accounts *(–, R)*
- [ ] Refunds to the payer's card (vs internal credits) *(N, R)*
- [ ] Disputes / chargeback handling *(N, R)* (also §C)
- [ ] Holds / escrow / authorize-capture *(–, R)*
- [ ] Statements / receipts documents *(N, R)*
- [ ] Reconciliation / settlement reports *(N, R)*
- [ ] KYC / Connect onboarding *(–, R)*
- [ ] Fee / commission splitting *(–, R)*

These define the line between the current **single-custodial stored-value
ledger** and a payment app. They require a Connect-style integration and a
money-transmitter compliance posture — an explicit **non-goal** of the
current design (documented under Scope §Non-goals).

### F. Subscription lifecycle

Solid: hosted checkout, proration upgrade (`updateSubscription`), billing
portal, plan CRUD + boot sync, price attribution (lookup_key→priceId),
trials, pricing hydration.

- [ ] **No first-party cancel / cancel-at-period-end** *(R, N)* — no
  `cancelSubscription` on `IBillingProvider`; delegated to the hosted portal.
- [ ] **No downgrade / scheduled plan-change API** *(R, N)*
- [ ] **No reactivate / un-cancel** *(N, –)*
- [ ] **`seats` is display-only** *(N, –)* — never sent to the provider or
  enforced against membership.
- [ ] **No dunning / past_due lifecycle** *(R, N)* (see §B invoice events).
- [ ] **`SubscriptionStatus` union omits provider states** *(R, N)* — Stripe
  emits `unpaid` / `incomplete_expired`, persisted verbatim but absent from
  the TS union; exhaustive switches mishandle them.
- [ ] **No invoice / payment history** *(N, R)*

---

## Event taxonomy (target design)

Two families, two consumers — keep them distinct.

**1. Domain events** — `EVENT_KEYS` const, dotted `fonderie.billing.*`,
payload **must include top-level `workspaceId`** when workspace-scoped (the
field `webhooks/dispatcher.ts:25` fans out on). The durable "what happened"
record; consumed by `@fonderie/webhooks` and any in-process subscriber.
Naming mirrors `customers/config.ts:1` and `auth/config.ts:50`.

**2. Notification events** — `NOTIFICATION_EVENT`
(`'fonderie.notification.send'`), payload `ICourierMessage { type, recipient,
data }`. The only thing courier acts on; `type` is a `MESSAGE_KEYS` entry →
template. Not forwarded to customer webhooks (no top-level `workspaceId`),
which is correct.

Every money flow emits a domain event (always) **and**, per the governing
principle, a notification (when a recipient resolves).

| Flow | Domain event (→ webhooks / in-process) | Notification (`MESSAGE_KEYS` → courier) |
|---|---|---|
| Purchase / top-up succeeds | `fonderie.billing.credit_pack.purchased` + `…wallet.credited` | `billing.payment-receipt` |
| Refund | `fonderie.billing.payment.refunded` + `…wallet.debited` (clawback) | `billing.refund-processed` |
| Transaction denied | `fonderie.billing.payment.failed` | `billing.payment-failed` (dunning) |
| Subscription lifecycle | `…subscription.{created,updated,canceled,past_due}` | `billing.subscription-canceled`; `billing.payment-failed` on past_due |
| Periodic grant | `…grant.applied` | — |
| Low balance | `…wallet.low_balance` | `billing.credits-low` |

Domain payload: `{ subscriberType, subscriberId, workspaceId?, currency,
amount|credits, balanceAfter?, providerTxId?, reason? }`.

## Design decision — recipient resolution (chosen: injected resolver)

Billing's money flows are webhook-driven (no `ctx.user`), so billing has a
`subscriberId` but not an email. Chosen approach: **an optional
`resolveRecipient(subscriberType, subscriberId) → { email, phone? }`
injected via `BillingConfig`** — the same interface-injection idiom as
`IBillingProvider`.

Rationale, tied to the framework's own rules:
- **"Modules receive interfaces, never concretes."** A resolver callback is
  that interface — billing depends on a function, not on `@fonderie/auth`'s
  tables, and works even when the billing contact isn't a Fonderie user.
- **"Bricks eliminate boilerplate."** Billing ships knowing *which* flows
  warrant a message and *which* template — the app supplies one small
  function. The alternative (app hand-writes every domain→email mapping)
  re-imposes the plumbing Fonderie exists to remove.
- **Matches the codebase.** Auth emits `NOTIFICATION_EVENT` directly; the
  resolver just supplies the recipient that the webhook context lacks.
- **Superset, not either/or.** Domain events are emitted regardless, so any
  app can still subscribe and do its own mapping.

**Fail-loud default.** Domain events emit unconditionally. If payments/wallet
are enabled but no recipient path is wired (`resolveRecipient` absent *and*
no bus+courier), `BillingModule.checkReadiness()` raises a
production-severity problem — exactly the mechanism `@fonderie/auth` uses to
make "MFA enabled without `mfaSecretKey`" an error in production. Dev/test
(non-production) proceeds so suites need no mail server.

---

## Scope of work (phased; each phase is a PR)

### Phase 1 — Domain event emission (unblocks webhooks + in-process) — ✅ shipped (6.1.0)
- [x] Add `@fonderie/events` peer dep; `BillingModule` accepts optional `bus?: EventBus`.
- [x] Add `EVENT_KEYS` (`fonderie.billing.*`) per the taxonomy.
- [x] Emit domain events (with `workspaceId` when workspace-scoped) at:
  subscription webhook upsert; wallet credit/grant; pack purchase.
  *(low-balance crossing event `wallet.low_balance` landed with Phase 2.)*
- [x] Tests: emitted keys + payloads; `@fonderie/webhooks` forwards a
  workspace-scoped billing event end-to-end.

### Phase 2 — Communication integrity (the governing principle) — ✅ implemented
- [x] Add `resolveRecipient?` to `BillingConfig` (+ `IBillingRecipient`,
  `ResolveRecipient`). Webhook flows have no session, so the app maps a
  subscriber id → address; returning `null` sends nothing.
- [x] Add `MESSAGE_KEYS`: `billing.payment-receipt`, `billing.payment-failed`,
  `billing.subscription-canceled`, `billing.credits-low`.
  `billing.refund-processed` is declared for the full contract but **not yet
  emitted** — it needs the normalized refund event from Phase 3.
- [x] Emit `NOTIFICATION_EVENT` when a recipient resolves, on the transition
  INTO the state (so provider retries don't re-send): pack-purchase receipt
  (payment webhook), past_due dunning + cancellation (subscription webhook),
  low-balance (withBilling, once per crossing with recovery hysteresis, plus
  the `wallet.low_balance` domain event). **Refund / one-time-payment declined
  defer to Phase 3** — the current provider parsing surfaces neither in
  normalized form, so there is nothing to notify on until normalization lands.
- [x] `BillingModule.checkReadiness()`: **error** in production (warning
  elsewhere) when payments/wallet are enabled but no receipt path
  (bus + `resolveRecipient`) is configured. Aggregated by
  `app.checkProductionReadiness()` and fail-closed at boot.
- [x] **Templates NOT shipped — deliberate.** Templates are courier's boundary
  (`@fonderie/courier` owns rendering + revisions); billing owns the *message
  contract* (the `type` + `data` payload), documented in the taxonomy above.
  Shipping billing-side templates would duplicate courier and couple the two.
- [x] Tests: receipt on purchase (+ replay no-op); past_due/cancel notices with
  transition dedup; low-balance once-per-crossing + re-arm; readiness
  error/warning matrix; `notifyBilling` no-bus/no-resolver/null/throw paths.

### Phase 3 — Provider normalization + refund/chargeback clawback (financial integrity)
- [ ] Extend `IBillingEvent` to carry invoice / refund / dispute / charge
  payloads (amount, currency, id, reason, `providerTxId`).
- [ ] Normalize in `StripeProvider.constructEvent`: `charge.refunded`,
  `charge.dispute.created/.closed`, `checkout.session.async_payment_failed`,
  `invoice.payment_failed` / `invoice.paid`, `payment_intent.payment_failed`.
- [ ] Payment webhook: on refund/chargeback, **reverse wallet credits**
  (ledger `type:'refund'`, negative, idempotent on `providerTxId`) — closes
  the §C value-leak — with the §A/§2 notification.
- [ ] Widen `SubscriptionStatus` to the states the provider actually sends.
- [ ] Tests incl. the buy→spend→refund clawback scenario.

### Phase 4 — Subscription lifecycle first-party controls (credit-SaaS polish)
- [ ] `cancelSubscription` on `IBillingProvider` + first-party cancel /
  cancel-at-period-end / reactivate / downgrade endpoints; dunning grace.

### Non-goals (explicit, until a money-transmitter decision is made)
Peer-to-peer transfers, external payouts/withdrawals, refunds-to-card,
escrow/holds, KYC/Connect onboarding, fee-splitting, settlement
reconciliation (§E). A payment-app pivot means a Connect-style integration
and a money-transmitter compliance program — a product+legal decision, not a
code change. Documented here so "it's a payment app" is never assumed of the
current brick.

---

## Acceptance criteria / invariants

- Every money event emits a durable domain event on the bus.
- No purchase, refund, or declined transaction completes without a customer
  communication path — enforced by `checkReadiness()` in production.
- A provider refund/chargeback reverses the corresponding wallet credits
  idempotently; ledger and provider balance cannot silently diverge.
- Domain events reach `@fonderie/webhooks` for customer fan-out with no
  billing→webhooks coupling.

## Appendix — verification method

13-agent audit over the real code (5 capability/event mappers + 8 adversarial
verifiers). Load-bearing claims, each upheld 2/2:
1. Billing emits zero EventBus events → nothing subscribable, nothing to webhooks.
2. `constructEvent` normalizes only the 5 subscription/checkout families.
3. Refund/chargeback credit reversal has no automated path (manual credit only).
4. No transfer / payout / escrow / fee-split — single-custodial per-(subscriber,currency) balance.
