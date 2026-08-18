# @fonderie/vue-courier-admin-screens

Pre-built Vue 3 screens for the Fonderie courier admin API —
`TemplateListScreen` and `TemplateEditorScreen` — built on
[`@fonderie/vue-courier-admin`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-courier-admin)
composables. Plain HTML elements via Vue's `h()` render function, inline
styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-courier-admin-screens
```

## Use

```vue
<script setup>
import { CourierAdminClient } from '@fonderie/client';
import { TemplateListScreen, TemplateEditorScreen } from '@fonderie/vue-courier-admin-screens';

const admin = new CourierAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: import.meta.env.VITE_FONDERIE_ADMIN_TOKEN,
});
</script>

<template>
  <TemplateListScreen :client="admin" @select-template="(t) => (route = `edit/${t.type}`)" />
  <TemplateEditorScreen :client="admin" type="password-reset" @saved="route = 'list'" />
</template>
```

`TemplateListScreen` lists every template with its locale and active state.
`TemplateEditorScreen` is a subject/HTML/plain-text form with a revision
history and one-click rollback, using the loaded template's version as
optimistic-concurrency `ifVersion` on save. Need just the state management
without the markup? Use `@fonderie/vue-courier-admin`'s composables
directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built Vue admin UI for courier's templates, so
you don't have to build a template editor from scratch. Swap it for your own
design system whenever you outgrow it — `@fonderie/vue-courier-admin`'s
composables work standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
