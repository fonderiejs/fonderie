---
'@fonderie/billing': minor
---

Phase 2: billing communicates money events to the customer (governing principle: no money moves without a durable record AND a clear customer communication)

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
