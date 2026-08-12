# @fonderie/react-config-admin-screens

Pre-built React screens for the Fonderie config admin API —
`ConfigListScreen` and `ConfigEditorScreen` — built on
[`@fonderie/react-config-admin`](https://github.com/fonderie-js/sdk/tree/main/packages/react-config-admin)
hooks. Plain HTML elements, inline styles you can override, zero UI library
dependency.

## Install

```sh
npm install @fonderie/react-config-admin-screens
```

## Use

```tsx
import { ConfigAdminClient } from '@fonderie/client';
import { ConfigListScreen, ConfigEditorScreen } from '@fonderie/react-config-admin-screens';

const admin = new ConfigAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: process.env.FONDERIE_ADMIN_TOKEN!,
});

function Dashboard() {
  return (
    <ConfigListScreen
      client={admin}
      onSelectConfig={(key) => setRoute(`config/${key}`)}
      onSelectSecret={(key) => setRoute(`secret/${key}`)}
    />
  );
}

function EditEntry({ kind, key }: { kind: 'config' | 'secret'; key: string }) {
  return <ConfigEditorScreen client={admin} kind={kind} configKey={key} onSaved={() => setRoute('list')} />;
}
```

`ConfigListScreen` shows every config entry and every secret (masked, with a
per-row reveal button) in one dashboard. `ConfigEditorScreen` handles both
resource kinds — a JSON editor for config values, a masked value + reveal
for secrets — with revision history and one-click rollback for either,
using the loaded entry's version as optimistic-concurrency `ifVersion` on
save. Need just the state management without the markup? Use
`@fonderie/react-config-admin`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React admin UI for config and secrets, so
you don't have to build a settings dashboard from scratch. Swap it for your
own design system whenever you outgrow it —
`@fonderie/react-config-admin`'s hooks work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
