# @fonderie/react-native-customers

React Native hooks for Fonderie's customers module — re-exports
[`@fonderie/react-customers`](https://github.com/fonderiejs/sdk/tree/main/packages/react-customers)
wholesale. Like billing and workspaces, the customers hooks own no storage
of their own, so there's no platform-specific code to fork — the same
hooks work in React Native as-is.

## Install

```sh
npm install @fonderie/react-native-customers
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useCustomers } from '@fonderie/react-native-customers';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Customers() {
  const { customers, isLoading } = useCustomers(client.customers);
  return (
    <FlatList
      data={customers}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <Text>{item.firstName} {item.lastName}</Text>}
    />
  );
}
```

Want a pre-built screen instead of wiring your own customer manager? See
[`@fonderie/react-native-customers-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-customers-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** making `@fonderie/react-customers`'s hooks
installable under the React Native naming convention, so an agent or
developer looking for "customer/CRM hooks for my Expo app" finds them
without having to know the hooks happen to be framework-agnostic under
the hood.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
