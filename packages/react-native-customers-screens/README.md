# @fonderie/react-native-customers-screens

Pre-built React Native screens for Fonderie's customers module —
`CustomersListScreen` and `CustomerDetailScreen` — built on
[`@fonderie/react-native-customers`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-customers)'s
hooks. `FlatList`/`TextInput`/`TouchableOpacity`, no navigation or UI
library dependency baked in.

## Install

```sh
npm install @fonderie/react-native-customers-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { CustomersListScreen } from '@fonderie/react-native-customers-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function CustomersPage() {
  return <CustomersListScreen client={client.customers} onSelectCustomer={(id) => navigation.navigate('CustomerDetail', { id })} />;
}
```

`CustomersListScreen` has a search box, a create form, and a list showing
a blacklisted badge. `CustomerDetailScreen` has a profile edit form plus
inline management of emails, phones, tags, and notes. Relationships and
the shared label vocabulary aren't covered by the pre-built screens — use
`@fonderie/react-native-customers`'s `useCustomerRelationships`/
`useCustomerLabels` hooks directly for those. Wire
`onSelectCustomer`/`onNavigateToList` to your navigator of choice.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built React Native customer manager, so you
don't have to build one from scratch. Swap it for your own design system
whenever you outgrow it — `@fonderie/react-native-customers`'s hooks work
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
