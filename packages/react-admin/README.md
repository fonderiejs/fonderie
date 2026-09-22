# @fonderie/react-admin

React hooks over [`@fonderie/admin`](../admin) — the operator's surface. One per
page: `useAttention`, `useManifest`, `useDoctor`, `useAdminConfig`,
`useAdminRoutes`, `useAdminTokens` (+ `issue` / `revoke`, root token only),
`useAdminLog` (paged, `loadMore`) — and over
`AuthAdminClient` (`@fonderie/auth`'s described user routes): `useAdminUser`
(lookup by email or id; `suspend`, `unsuspend`, `revokeSessions`),
`useAdminUserSessions`, `useAdminLoginHistory` (paged) — and over `BillingAdminClient`
(`@fonderie/billing`'s): `useAdminCatalog` (configured vs stored; `createPlan`,
`updatePlan`, `deletePlan`), `useAdminSubscriber` (subscription, wallet, paged
ledger, `grant`) — and over `AuditAdminClient` (`@fonderie/audit`'s):
`useAdminAudit` (every workspace unless one is named; paged).

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
