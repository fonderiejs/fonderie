# @fonderie/react-native-audit-screens

Pre-built React Native screen for Fonderie's audit log — `AuditLogScreen` —
built on [`@fonderie/react-native-audit`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-audit)'s
`useAuditEvents` hook. Native `View`/`FlatList`/`TextInput` components,
inline styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/react-native-audit-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { AuditLogScreen } from '@fonderie/react-native-audit-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function AuditRoute() {
  return <AuditLogScreen client={client.audit} />;
}
```

`AuditLogScreen` has a type/actor filter form, a scrollable list of events
with tap-to-expand JSON payloads, and a load-more button for cursor
pagination. Need just the state management without the markup? Use
`@fonderie/react-native-audit`'s `useAuditEvents` hook directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built React Native audit-log viewer, so you
don't have to build one from scratch. Swap it for your own design system
whenever you outgrow it — `@fonderie/react-native-audit`'s hook works
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
