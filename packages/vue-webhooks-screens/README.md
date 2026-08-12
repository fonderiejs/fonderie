# @fonderie/vue-webhooks-screens

Pre-built Vue 3 screens for Fonderie's webhooks module —
`WebhooksListScreen` and `WebhookDetailScreen` — built on
[`@fonderie/vue-webhooks`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-webhooks)'s
composables. Plain `h()`-based components with inline styles you can
override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-webhooks-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { WebhooksListScreen } from '@fonderie/vue-webhooks-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
</script>

<template>
  <WebhooksListScreen :client="client.webhooks" @select-endpoint="onSelect" />
</template>
```

`WebhooksListScreen` has a create form (URL + comma-separated events), a
list with test/delete buttons, and a one-time banner showing the signing
secret right after creation; it emits `select-endpoint`. `WebhookDetailScreen`
has an edit form (url/events/enabled) and the endpoint's delivery history;
it emits `navigate-list`. Need just the state management without the
markup? Use `@fonderie/vue-webhooks`'s composables directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built Vue webhooks manager, so you don't have
to build one from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/vue-webhooks`'s composables work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
