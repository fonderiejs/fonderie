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

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what the caller pays for. Plans, subscriptions, feature gates, and
usage limits — the commercial rules the other bricks consult before acting.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
