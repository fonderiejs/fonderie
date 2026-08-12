# @fonderie/vue-audit

Vue 3 composable for Fonderie's audit log — `useAuditEvents`
(cursor-paginated, filterable by `type`/`actorId`/date range, with
`loadMore`). Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself,
nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-audit
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/vue-audit';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { events, hasMore, loadMore } = useAuditEvents(client.audit, { type: 'workspace.updated' });
</script>

<template>
  <ul>
    <li v-for="e in events" :key="e.id">{{ e.type }} — {{ e.createdAt }}</li>
  </ul>
  <button v-if="hasMore" @click="loadMore">Load more</button>
</template>
```

`useAuditEvents` takes the same `AuditClient` instance (`client.audit`) —
construct one `FonderieClient` at the app root and pass it down
(provide/inject or a prop). The client's access token is shared with
`client.auth` automatically, so signing in via
[`@fonderie/vue-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-auth)
is enough to authenticate audit requests too. Requests default to the
caller's personal workspace until you call `client.audit.setWorkspaceId(id)`
to scope them to a team, same as `client.billing`/`client.workspaces`.

`@fonderie/audit` has one route, read-only — there's no create/update/delete
composable because there's no such endpoint; audit events are written
internally by other modules. Filters are read once at setup, same as every
other `*-admin`/`*-workspaces` composable's `key`/`environment` params in
this SDK — call `refresh()` yourself after changing filters.

Want a pre-built screen instead of wiring your own log viewer?
See [`@fonderie/vue-audit-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-audit-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for the audit log — reactive state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/audit` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
