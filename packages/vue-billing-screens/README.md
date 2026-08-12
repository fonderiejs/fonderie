# @fonderie/vue-billing-screens

Pre-built Vue 3 billing screens — `PricingScreen` and `SubscriptionScreen` —
built on
[`@fonderie/vue-billing`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-billing)
composables. Plain HTML elements via Vue's `h()` render function, inline
styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-billing-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { PricingScreen, SubscriptionScreen } from '@fonderie/vue-billing-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
</script>

<template>
  <PricingScreen :client="client.billing" @checkout-start="(url) => (location.href = url)" />
  <SubscriptionScreen
    :client="client.billing"
    @manage-billing="(url) => (location.href = url)"
    @navigate-pricing="route = 'pricing'"
  />
</template>
```

`PricingScreen` lists plans with a monthly/yearly toggle and starts Stripe
Checkout on choose. `SubscriptionScreen` shows the caller's current plan,
status, and renewal date, with a button into the Stripe billing portal.
Neither screen navigates on your behalf — both emit the Stripe-hosted URL
(`checkout-start` / `manage-billing`) and leave navigation to you, so the
component works the same in SSR and client-only apps. Need just the state
management without the markup? Use `@fonderie/vue-billing`'s composables
directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built Vue billing UI, so you don't have to build
a pricing table from scratch. Swap it for your own design system whenever
you outgrow it — `@fonderie/vue-billing`'s composables work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
