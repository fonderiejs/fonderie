# @fonderie/vue-customers-screens

Pre-built Vue 3 screens for Fonderie's customers module —
`CustomersListScreen` and `CustomerDetailScreen` — built on
[`@fonderie/vue-customers`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-customers)'s
composables. Plain `h()`-based components with inline styles you can
override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-customers-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { CustomersListScreen } from '@fonderie/vue-customers-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
</script>

<template>
  <CustomersListScreen :client="client.customers" @select-customer="onSelect" />
</template>
```

`CustomersListScreen` has a search box, a create form, and a list showing
a blacklisted badge; it emits `select-customer`. `CustomerDetailScreen`
has a profile edit form plus inline management of emails, phones, tags,
and notes; it emits `navigate-list`. Relationships and the shared label
vocabulary aren't covered by the pre-built screens — use
`@fonderie/vue-customers`'s `useCustomerRelationships`/
`useCustomerLabels` composables directly for those.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built Vue customer manager, so you don't have
to build one from scratch. Swap it for your own design system whenever
you outgrow it — `@fonderie/vue-customers`'s composables work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
