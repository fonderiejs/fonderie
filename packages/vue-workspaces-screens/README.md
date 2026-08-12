# @fonderie/vue-workspaces-screens

Pre-built Vue 3 workspaces screens — `TeamMembersScreen` and
`InviteMembersScreen` — built on
[`@fonderie/vue-workspaces`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-workspaces)
composables. Plain HTML elements via Vue's `h()` render function, inline
styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-workspaces-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { TeamMembersScreen, InviteMembersScreen } from '@fonderie/vue-workspaces-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const currentUserId = 'user_123';
</script>

<template>
  <TeamMembersScreen
    :client="client.workspaces"
    :current-user-id="currentUserId"
    @navigate-invite="route = 'invite'"
  />
  <InviteMembersScreen :client="client.workspaces" @navigate-members="route = 'team'" />
</template>
```

`TeamMembersScreen` lists members with their role and a remove button
(hidden for the signed-in user themselves). `InviteMembersScreen` has an
email input to send an invite and a list of pending invitations with a
cancel button on each. Need just the state management without the markup?
Use `@fonderie/vue-workspaces`'s composables directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built Vue workspaces UI, so you don't have to
build a team-management page from scratch. Swap it for your own design
system whenever you outgrow it — `@fonderie/vue-workspaces`'s composables
work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
