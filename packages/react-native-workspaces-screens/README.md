# @fonderie/react-native-workspaces-screens

Pre-built React Native workspaces screens — `TeamMembersScreen` and
`InviteMembersScreen` — built on
[`@fonderie/react-native-workspaces`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-workspaces)
hooks. Native `View`/`FlatList`/`TouchableOpacity` components, inline styles
you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/react-native-workspaces-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { TeamMembersScreen, InviteMembersScreen } from '@fonderie/react-native-workspaces-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function TeamRoute({ currentUserId }) {
  return (
    <TeamMembersScreen
      client={client.workspaces}
      currentUserId={currentUserId}
      onNavigateToInvite={() => navigation.navigate('Invite')}
    />
  );
}
```

`TeamMembersScreen` lists members with their role and a remove button
(hidden for the signed-in user themselves). `InviteMembersScreen` has an
email input to send an invite and a list of pending invitations with a
cancel button on each. Need just the state management without the markup?
Use `@fonderie/react-native-workspaces`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React Native workspaces UI, so you don't
have to build a team-management screen from scratch. Swap it for your own
design system whenever you outgrow it —
`@fonderie/react-native-workspaces`'s hooks work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
