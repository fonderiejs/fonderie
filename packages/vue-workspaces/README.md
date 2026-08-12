# @fonderie/vue-workspaces

Vue 3 composables for Fonderie workspaces — `useWorkspaces`,
`useCreateWorkspace`, `useMembers`, `useRemoveMember`, `useInvitations`,
`useAcceptInvitation`, `useWorkspaceSettings`, and role management
(`useRoles`, `useUpdateRole`, `useSetRolePermissions`, `useMemberRoles` —
`@fonderie/permissions` has no HTTP API of its own; role CRUD lives under
`@fonderie/workspaces`' routes). Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself, nothing
else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-workspaces
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { useWorkspaces, useMembers } from '@fonderie/vue-workspaces';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { workspaces } = useWorkspaces(client.workspaces);
const { members } = useMembers(client.workspaces);
</script>

<template>
  <select @change="(e) => client.workspaces.setWorkspaceId(e.target.value)">
    <option v-for="ws in workspaces" :key="ws.id" :value="ws.id">{{ ws.name }}</option>
  </select>
  <ul>
    <li v-for="m in members" :key="m.userId">{{ m.userId }} — {{ m.roleName }}</li>
  </ul>
</template>
```

Each composable takes the same `WorkspacesClient` instance
(`client.workspaces`) — construct one `FonderieClient` at the app root and
pass it down (provide/inject or a prop). The client's access token is shared
with `client.auth` automatically, so signing in via
[`@fonderie/vue-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-auth)
is enough to authenticate workspace requests too. Requests default to the
caller's personal workspace until you call
`client.workspaces.setWorkspaceId(id)` to scope them to a team.

Want pre-built screens instead of wiring your own team list?
See [`@fonderie/vue-workspaces-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-workspaces-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for workspaces — reactive state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/workspaces` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
