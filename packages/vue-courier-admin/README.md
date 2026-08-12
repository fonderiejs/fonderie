# @fonderie/vue-courier-admin

Vue 3 composables for the Fonderie courier admin API — `useTemplates`,
`useTemplate`, `useSaveTemplate`, `useDeleteTemplate`, and
`useTemplateRevisions` (list + rollback). Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client)'s
`CourierAdminClient`: reactive `ref`s for loading/error/data state and the
request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-courier-admin
```

## Use

```vue
<script setup>
import { CourierAdminClient } from '@fonderie/client';
import { useTemplates, useSaveTemplate } from '@fonderie/vue-courier-admin';

const admin = new CourierAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: import.meta.env.VITE_FONDERIE_ADMIN_TOKEN,
});

const { templates } = useTemplates(admin);
const { saveTemplate } = useSaveTemplate(admin);
</script>

<template>
  <ul>
    <li v-for="t in templates" :key="t.type">{{ t.type }}</li>
  </ul>
</template>
```

**This client is deliberately separate from `FonderieClient`.** Courier's
`/admin/templates/*` routes are guarded by a static bearer token configured
on the server (`CourierModule`'s `adminToken`), not the signed-in user's
session — the same model `@fonderie/config`'s admin surface and the
`fonderie template`/`fonderie config` CLI commands use. Construct
`CourierAdminClient` with that token directly; it does not share state with
`AuthClient`/`BillingClient`/`WorkspacesClient`.

Want pre-built screens instead of wiring your own editor?
See [`@fonderie/vue-courier-admin-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-courier-admin-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for courier's template admin API —
reactive state management around `@fonderie/client`, nothing more. No
business logic lives here; it lives in `@fonderie/courier` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
