# @fonderie/vue-audit-screens

Pre-built Vue 3 screen for Fonderie's audit log — `AuditLogScreen` — built
on [`@fonderie/vue-audit`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-audit)'s
`useAuditEvents` composable. Plain HTML elements via Vue's `h()` render
function, inline styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-audit-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { AuditLogScreen } from '@fonderie/vue-audit-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
</script>

<template>
  <AuditLogScreen :client="client.audit" />
</template>
```

`AuditLogScreen` has a type/actor filter form, a list of events with
click-to-expand JSON payloads, and a load-more button for cursor
pagination. Need just the state management without the markup? Use
`@fonderie/vue-audit`'s `useAuditEvents` composable directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built Vue audit-log viewer, so you don't have
to build one from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/vue-audit`'s composable works standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
