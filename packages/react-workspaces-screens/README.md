# @fonderie/react-workspaces-screens

Pre-built React workspaces screens — `TeamMembersScreen` and
`InviteMembersScreen` — built on
[`@fonderie/react-workspaces`](https://github.com/fonderie-js/sdk/tree/main/packages/react-workspaces)
hooks. Plain HTML elements, inline styles you can override, zero UI library
dependency.

## Install

```sh
npm install @fonderie/react-workspaces-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { TeamMembersScreen, InviteMembersScreen } from '@fonderie/react-workspaces-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Team({ currentUserId }) {
  return (
    <TeamMembersScreen
      client={client.workspaces}
      currentUserId={currentUserId}
      onNavigateToInvite={() => setRoute('invite')}
    />
  );
}

function Invite() {
  return (
    <InviteMembersScreen
      client={client.workspaces}
      onNavigateToMembers={() => setRoute('team')}
    />
  );
}
```

`TeamMembersScreen` lists members with their role and a remove button
(hidden for the signed-in user themselves). `InviteMembersScreen` has an
email input to send an invite and a list of pending invitations with a
cancel button on each. Need just the state management without the markup?
Use `@fonderie/react-workspaces`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React workspaces UI, so you don't have to
build a team-management page from scratch. Swap it for your own design
system whenever you outgrow it — `@fonderie/react-workspaces`'s hooks work
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
