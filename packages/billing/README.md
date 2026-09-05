# @fonderie/billing

SaaS billing as a brick: a config-driven plan catalogue, Stripe
subscriptions, feature gates, and usage limits — so "can this workspace do
that?" is one function call.

## Install

```sh
npm install @fonderie/billing
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { BillingModule } from '@fonderie/billing';

const app = await new FonderieApp(defineConfig({}))
  .register(new BillingModule())
  .boot();
```

Gate routes and features:

```ts
import { requirePlan, requireFeature, hasFeature, getPlanLimit } from '@fonderie/billing';
```

`StripeProvider` handles checkout and webhook events; usage counters run
on `MemoryCounterBackend` or `DBCounterBackend`.

## Stored-value wallet (opt-in)

Setting `wallet` on the billing config turns on a ledger-backed credit
wallet: subscribers hold a balance (`bigint`, smallest currency unit), buy
config-defined credit packs through one-time provider checkout, and plans
price metered actions in credits.

```ts
new BillingModule(store, {
  provider: new StripeProvider(secretKey),
  successUrl, cancelUrl, webhookSecret,
  wallet: {
    currency: 'USD',
    webhookSecret: process.env.STRIPE_PAYMENT_WEBHOOK_SECRET, // separate endpoint
    creditPacks: [{ id: 'small', name: 'Small pack', credits: 5000n, priceAmount: 499n }],
  },
  plans: [{
    name: 'payg',
    wallet: {
      grantAmount: 50n, // auto-granted lazily, once per period
      rates: { 'sms:send': { cost: 75n, unit: 'msg' } },
    },
  }],
});
```

Every mutation goes through the append-only ledger with an idempotency
key — the balance table is a cache, debits are atomic (`FOR UPDATE` plus a
conditional-update floor), and webhook replays are no-ops. In routes:
`requireWalletBalance('sms:send')` gates on affordability; inside the unit
of work, `debitWalletForMetric(ctx, 'sms:send', { idempotencyKey: taskId }, store)`
charges the plan rate exactly once. Wallet amounts cross HTTP as digit
strings (`IWalletDTO`).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what the caller pays for. Plans, subscriptions, feature gates, and
usage limits — the commercial rules the other bricks consult before acting.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
