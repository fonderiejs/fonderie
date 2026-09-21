# @fonderie/react-admin

React hooks over [`@fonderie/admin`](../admin) — the operator's surface. One per
page: `useAttention`, `useManifest`, `useDoctor`, `useAdminConfig`,
`useAdminRoutes`, `useAdminTokens`, `useAdminLog` (paged, `loadMore`).

Status: **experimental** (0.x).

```ts
import { AdminClient, useAttention } from '@fonderie/react-admin';

const admin = new AdminClient({ baseUrl: 'https://api.example.com', adminToken, actor: 'louis' });
const { attention, isLoading, error, refresh } = useAttention(admin);
```

Every hooks takes the `AdminClient` instance; nothing here stores the token.
`prefix` on the client follows the app when it moved the surface off
`/_admin`. The shell that composes these with the config and courier admin
screens is `@fonderie/react-admin-screens` (next phase).
