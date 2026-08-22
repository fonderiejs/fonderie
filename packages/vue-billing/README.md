# @fonderie/vue-billing

Vue 3 composables for Fonderie billing — `usePlans`, `usePlan`,
`useSubscription`, `useCheckout`, `useBillingPortal`, `useUsage`, and
`useRecordUsage`. Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself, nothing
else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-billing
```

## One client at the root (recommended)

Install the plugin from [`@fonderie/vue`](../vue) once (or call
`provideFonderie(client)` in a root `setup()`) and every composable resolves
the client by injection — no client argument at call sites:

```ts
import { FonderiePlugin } from "@fonderie/vue";

createApp(App).use(FonderiePlugin, client).mount("#app");

// in any component setup():
const { ...state } = usePlans();
```

Passing a client explicitly (as below) still works everywhere and takes
precedence over injection — handy in tests and multi-client apps.

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { usePlans, useCheckout } from '@fonderie/vue-billing';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { plans } = usePlans(client.billing);
const { checkout } = useCheckout(client.billing);

async function choose(planName) {
  window.location.href = await checkout({ plan: planName });
}
</script>

<template>
  <ul>
    <li v-for="plan in plans" :key="plan.id">
      {{ plan.name }}
      <button @click="choose(plan.name)">Choose</button>
    </li>
  </ul>
</template>
```

Each composable takes the same `BillingClient` instance (`client.billing`) —
construct one `FonderieClient` at the app root and pass it down
(provide/inject or a prop). The client's access token is shared with
`client.auth` automatically, so signing in via
[`@fonderie/vue-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-auth)
is enough to authenticate billing requests too. Billing by workspace instead
of by user? Call `client.billing.setWorkspaceId(id)`.

Want pre-built screens instead of wiring your own pricing table?
See [`@fonderie/vue-billing-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-billing-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for billing — reactive state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/billing` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
