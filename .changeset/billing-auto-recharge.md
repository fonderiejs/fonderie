---
'@fonderie/billing': minor
---

Wallet auto-recharge — automatic off-session top-up when a balance runs low

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
