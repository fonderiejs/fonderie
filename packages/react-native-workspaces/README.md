# @fonderie/react-native-workspaces

React Native workspaces hooks for Fonderie — re-exports
[`@fonderie/react-workspaces`](https://github.com/fonderie-js/sdk/tree/main/packages/react-workspaces)
wholesale. Like billing, workspace hooks own no storage of their own, so
there's no platform-specific code to fork — the same `useWorkspaces`,
`useCreateWorkspace`, `useMembers`, `useRemoveMember`, `useInvitations`,
`useAcceptInvitation`, and `useWorkspaceSettings` hooks work in React Native
as-is.

## Install

```sh
npm install @fonderie/react-native-workspaces
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useMembers } from '@fonderie/react-native-workspaces';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Team() {
  const { members } = useMembers(client.workspaces);
  return (
    <FlatList data={members} keyExtractor={(m) => m.userId} renderItem={({ item }) => <Text>{item.userId}</Text>} />
  );
}
```

Want pre-built screens instead of wiring your own team list?
See [`@fonderie/react-native-workspaces-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-workspaces-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** making `@fonderie/react-workspaces`'s hooks
installable under the React Native naming convention, so an agent or
developer looking for "workspace hooks for my Expo app" finds them without
having to know the hooks happen to be framework-agnostic under the hood.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
