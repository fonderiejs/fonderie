# @fonderie/vue-config-admin-screens

Pre-built Vue 3 screens for the Fonderie config admin API —
`ConfigListScreen` and `ConfigEditorScreen` — built on
[`@fonderie/vue-config-admin`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-config-admin)
composables. Plain HTML elements via Vue's `h()` render function, inline
styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-config-admin-screens
```

## Use

```vue
<script setup>
import { ConfigAdminClient } from '@fonderie/client';
import { ConfigListScreen, ConfigEditorScreen } from '@fonderie/vue-config-admin-screens';

const admin = new ConfigAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: import.meta.env.VITE_FONDERIE_ADMIN_TOKEN,
});
</script>

<template>
  <ConfigListScreen
    :client="admin"
    @select-config="(key) => (route = `config/${key}`)"
    @select-secret="(key) => (route = `secret/${key}`)"
  />
  <ConfigEditorScreen :client="admin" kind="config" config-key="feature.newDashboard" @saved="route = 'list'" />
</template>
```

`ConfigListScreen` shows every config entry and every secret (masked, with a
per-row reveal button) in one dashboard. `ConfigEditorScreen` handles both
resource kinds — a JSON editor for config values, a masked value + reveal
for secrets — with revision history and one-click rollback for either,
using the loaded entry's version as optimistic-concurrency `ifVersion` on
save. Need just the state management without the markup? Use
`@fonderie/vue-config-admin`'s composables directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built Vue admin UI for config and secrets, so you
don't have to build a settings dashboard from scratch. Swap it for your own
design system whenever you outgrow it — `@fonderie/vue-config-admin`'s
composables work standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
