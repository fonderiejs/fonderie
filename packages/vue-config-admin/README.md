# @fonderie/vue-config-admin

Vue 3 composables for the Fonderie config admin API — feature flags/remote
config (`useConfigEntries`, `useConfigEntry`, `useSaveConfigEntry`,
`useDeleteConfigEntry`, `useConfigRevisions`) and secrets (`useSecrets`,
`useSecret`, `useSaveSecret`, `useDeleteSecret`, `useSecretRevisions`,
`useRevealSecret`). Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client)'s
`ConfigAdminClient`: reactive `ref`s for loading/error/data state and the
request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-config-admin
```

## Use

```vue
<script setup>
import { ConfigAdminClient } from '@fonderie/client';
import { useConfigEntries, useRevealSecret } from '@fonderie/vue-config-admin';

const admin = new ConfigAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: import.meta.env.VITE_FONDERIE_ADMIN_TOKEN,
});

const { entries } = useConfigEntries(admin);
const { revealSecret } = useRevealSecret(admin);
</script>

<template>
  <ul>
    <li v-for="e in entries" :key="e.key">{{ e.key }}</li>
  </ul>
</template>
```

**This client is deliberately separate from `FonderieClient`.** Config's
`/admin/config/*` and `/admin/secrets/*` routes are guarded by a static
bearer token configured on the server (`ConfigModule`'s `adminToken`), not
the signed-in user's session — the same model
[`@fonderie/vue-courier-admin`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-courier-admin)
uses. Construct `ConfigAdminClient` with that token directly; it does not
share state with `AuthClient`/`BillingClient`/`WorkspacesClient`.

Want pre-built screens instead of wiring your own dashboard?
See [`@fonderie/vue-config-admin-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-config-admin-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for config's admin API — reactive
state management around `@fonderie/client`, nothing more. No business logic
lives here; it lives in `@fonderie/config` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
