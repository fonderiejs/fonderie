# @fonderie/vue-customers

Vue 3 composables for Fonderie's customers module (a workspace-scoped
CRM) — `useCustomers`, `useCustomer`, and one combined composable per
sub-resource: `useCustomerEmails`, `useCustomerPhones`,
`useCustomerAddresses`, `useCustomerNotes`, `useCustomerTags`,
`useCustomerRelationships`, `useCustomerLabels`. Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself,
nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-customers
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { useCustomers } from '@fonderie/vue-customers';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { customers, createCustomer } = useCustomers(client.customers, { search: 'acme' });
</script>

<template>
  <ul>
    <li v-for="c in customers" :key="c.id">{{ c.firstName }} {{ c.lastName }}</li>
  </ul>
</template>
```

These composables take the same `CustomersClient` instance
(`client.customers`) — construct one `FonderieClient` at the app root and
pass it down (provide/inject or a prop). The client's access token is
shared with `client.auth` automatically, so signing in via
[`@fonderie/vue-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-auth)
is enough to authenticate customer requests too. Requests default to the
caller's personal workspace until you call
`client.customers.setWorkspaceId(id)` to scope them to a team, same as
`client.billing`/`client.workspaces`/`client.webhooks`.

Only the label is editable on an existing email/phone/address — the value
itself is immutable once added; remove and re-add to change it. Matches
`@fonderie/customers`' controllers exactly. Params/customer IDs are read
once at setup, same as every other `*-admin`/`*-workspaces` composable's
`key`/`environment` params in this SDK — call `refresh()` yourself after
changing them.

Want a pre-built screen instead of wiring your own customer manager? See
[`@fonderie/vue-customers-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-customers-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for customers — reactive state
management around `@fonderie/client`, nothing more. No business logic
lives here; it lives in `@fonderie/customers` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
