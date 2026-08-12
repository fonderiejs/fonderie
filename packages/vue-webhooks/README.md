# @fonderie/vue-webhooks

Vue 3 composables for Fonderie's webhooks module — `useWebhookEndpoints`
(list, create, delete), `useWebhookEndpoint` (get, update),
`useWebhookDeliveries` (delivery history), and `useTestWebhookEndpoint`
(send a test event). Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself,
nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-webhooks
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { useWebhookEndpoints } from '@fonderie/vue-webhooks';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { endpoints, createEndpoint, removeEndpoint } = useWebhookEndpoints(client.webhooks);
</script>

<template>
  <ul>
    <li v-for="e in endpoints" :key="e.id">
      {{ e.url }} <button @click="removeEndpoint(e.id)">Delete</button>
    </li>
  </ul>
</template>
```

These composables take the same `WebhooksClient` instance
(`client.webhooks`) — construct one `FonderieClient` at the app root and
pass it down (provide/inject or a prop). The client's access token is
shared with `client.auth` automatically, so signing in via
[`@fonderie/vue-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-auth)
is enough to authenticate webhook requests too. Requests default to the
caller's personal workspace until you call
`client.webhooks.setWorkspaceId(id)` to scope them to a team, same as
`client.billing`/`client.workspaces`.

`createEndpoint` returns the endpoint's signing secret — it's only ever
returned at creation time, so surface it to the user immediately and don't
expect to fetch it again later. Endpoint IDs/filters are read once at
setup, same as every other `*-admin`/`*-workspaces` composable's
`key`/`environment` params in this SDK — call `refresh()` yourself after
changing them.

Want a pre-built screen instead of wiring your own endpoint manager?
See [`@fonderie/vue-webhooks-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-webhooks-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for webhook endpoints — reactive
state management around `@fonderie/client`, nothing more. No business
logic lives here; it lives in `@fonderie/webhooks` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
