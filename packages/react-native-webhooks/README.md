# @fonderie/react-native-webhooks

React Native hooks for Fonderie's webhooks module — re-exports
[`@fonderie/react-webhooks`](https://github.com/fonderiejs/sdk/tree/main/packages/react-webhooks)
wholesale. Like billing and workspaces, the webhooks hooks own no storage of
their own, so there's no platform-specific code to fork — the same hooks
work in React Native as-is.

## Install

```sh
npm install @fonderie/react-native-webhooks
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useWebhookEndpoints } from '@fonderie/react-native-webhooks';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Webhooks() {
  const { endpoints, isLoading } = useWebhookEndpoints(client.webhooks);
  return (
    <FlatList
      data={endpoints}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => <Text>{item.url}</Text>}
    />
  );
}
```

Want a pre-built screen instead of wiring your own endpoint manager?
See [`@fonderie/react-native-webhooks-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-webhooks-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** making `@fonderie/react-webhooks`'s hooks installable
under the React Native naming convention, so an agent or developer looking
for "webhook hooks for my Expo app" finds them without having to know the
hooks happen to be framework-agnostic under the hood.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
