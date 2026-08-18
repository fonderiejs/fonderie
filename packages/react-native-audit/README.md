# @fonderie/react-native-audit

React Native hooks for Fonderie's audit log — re-exports
[`@fonderie/react-audit`](https://github.com/fonderiejs/sdk/tree/main/packages/react-audit)
wholesale. Like billing and workspaces, the audit hook owns no storage of
its own, so there's no platform-specific code to fork — the same
`useAuditEvents` hook works in React Native as-is.

## Install

```sh
npm install @fonderie/react-native-audit
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/react-native-audit';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function AuditLog() {
  const { events, hasMore, loadMore } = useAuditEvents(client.audit);
  return (
    <FlatList
      data={events}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <Text>{item.type}</Text>}
      onEndReached={hasMore ? loadMore : undefined}
    />
  );
}
```

Want a pre-built screen instead of wiring your own log viewer?
See [`@fonderie/react-native-audit-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-audit-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** making `@fonderie/react-audit`'s hook installable
under the React Native naming convention, so an agent or developer looking
for "audit log hooks for my Expo app" finds them without having to know the
hook happens to be framework-agnostic under the hood.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
