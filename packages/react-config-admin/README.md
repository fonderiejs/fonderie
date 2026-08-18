# @fonderie/react-config-admin

React hooks for the Fonderie config admin API — feature flags/remote config
(`useConfigEntries`, `useConfigEntry`, `useSaveConfigEntry`,
`useDeleteConfigEntry`, `useConfigRevisions`) and secrets (`useSecrets`,
`useSecret`, `useSaveSecret`, `useDeleteSecret`, `useSecretRevisions`,
`useRevealSecret`). Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client)'s
`ConfigAdminClient`: loading/error state and the request itself, nothing
else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-config-admin
```

## Use

```tsx
import { ConfigAdminClient } from '@fonderie/client';
import { useConfigEntries, useRevealSecret } from '@fonderie/react-config-admin';

const admin = new ConfigAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: process.env.FONDERIE_ADMIN_TOKEN!,
});

function ConfigList() {
  const { entries, isLoading } = useConfigEntries(admin);
  return <ul>{entries.map((e) => <li key={e.key}>{e.key}</li>)}</ul>;
}

function RevealButton({ secretKey }: { secretKey: string }) {
  const { revealSecret } = useRevealSecret(admin);
  return <button onClick={async () => alert(await revealSecret(secretKey))}>Reveal</button>;
}
```

**This client is deliberately separate from `FonderieClient`.** Config's
`/admin/config/*` and `/admin/secrets/*` routes are guarded by a static
bearer token configured on the server (`ConfigModule`'s `adminToken`), not
the signed-in user's session — the same model
[`@fonderie/react-courier-admin`](https://github.com/fonderiejs/sdk/tree/main/packages/react-courier-admin)
uses. Construct `ConfigAdminClient` with that token directly; it does not
share state with `AuthClient`/`BillingClient`/`WorkspacesClient`.

Want pre-built screens instead of wiring your own dashboard?
See [`@fonderie/react-config-admin-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-config-admin-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for config's admin API — state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/config` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
