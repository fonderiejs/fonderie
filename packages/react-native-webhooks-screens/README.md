# @fonderie/react-native-webhooks-screens

Pre-built React Native screens for Fonderie's webhooks module —
`WebhooksListScreen` and `WebhookDetailScreen` — built on
[`@fonderie/react-native-webhooks`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-webhooks)'s
hooks. `FlatList`/`TextInput`/`TouchableOpacity`, no navigation or UI
library dependency baked in.

## Install

```sh
npm install @fonderie/react-native-webhooks-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { WebhooksListScreen } from '@fonderie/react-native-webhooks-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function WebhooksPage() {
  return <WebhooksListScreen client={client.webhooks} onSelectEndpoint={(id) => navigation.navigate('WebhookDetail', { id })} />;
}
```

`WebhooksListScreen` has a create form (URL + comma-separated events), a
list with test/delete buttons, and a one-time banner showing the signing
secret right after creation. `WebhookDetailScreen` has an edit form
(url/events/enabled) and the endpoint's delivery history. Wire
`onSelectEndpoint`/`onNavigateToList` to your navigator of choice. Need
just the state management without the markup? Use
`@fonderie/react-native-webhooks`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built React Native webhooks manager, so you
don't have to build one from scratch. Swap it for your own design system
whenever you outgrow it — `@fonderie/react-native-webhooks`'s hooks work
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
