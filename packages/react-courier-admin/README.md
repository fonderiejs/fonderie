# @fonderie/react-courier-admin

React hooks for the Fonderie courier admin API — `useTemplates`,
`useTemplate`, `useSaveTemplate`, `useDeleteTemplate`, and
`useTemplateRevisions` (list + rollback). Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client)'s
`CourierAdminClient`: loading/error state and the request itself, nothing
else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-courier-admin
```

## Use

```tsx
import { CourierAdminClient } from '@fonderie/client';
import { useTemplates, useSaveTemplate } from '@fonderie/react-courier-admin';

const admin = new CourierAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: process.env.FONDERIE_ADMIN_TOKEN!,
});

function TemplateList() {
  const { templates, isLoading } = useTemplates(admin);
  return <ul>{templates.map((t) => <li key={t.type}>{t.type}</li>)}</ul>;
}

function EditTemplate({ type }: { type: string }) {
  const { saveTemplate, isLoading } = useSaveTemplate(admin);
  return (
    <button onClick={() => saveTemplate(type, { text: 'Hi {{name}}' })} disabled={isLoading}>
      Save
    </button>
  );
}
```

**This client is deliberately separate from `FonderieClient`.** Courier's
`/admin/templates/*` routes are guarded by a static bearer token configured
on the server (`CourierModule`'s `adminToken`), not the signed-in user's
session — the same model `@fonderie/config`'s admin surface and the
`fonderie template`/`fonderie config` CLI commands use. Construct
`CourierAdminClient` with that token directly; it does not share state with
`AuthClient`/`BillingClient`/`WorkspacesClient`.

Want pre-built screens instead of wiring your own editor?
See [`@fonderie/react-courier-admin-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-courier-admin-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for courier's template admin API —
state management around `@fonderie/client`, nothing more. No business logic
lives here; it lives in `@fonderie/courier` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
