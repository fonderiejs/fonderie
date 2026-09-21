# @fonderie/vue-admin-screens

The admin shell for Vue — the `/wp-admin` of a Fonderie app, over
[`@fonderie/admin`](../admin). Navigation follows the operator's questions;
each page is a screen you can also mount on its own.

Status: **experimental** (0.x).

| Group | Page | Answers |
|---|---|---|
| Today | Attention | what needs me today — empty is green |
| System | Modules · Configuration · Doctor · Routes | what did I deploy · is it configured · is it working · what is exposed |
| People | Users | why can't this person log in — lookup, sessions, sign-ins, suspend, sign out everywhere (`authClient`) |
| Money | Catalog · Subscriber | what am I selling (configured vs stored) · what is this subscriber on, their wallet, ledger, a manual grant (`billingClient`) |
| Settings | Config & secrets | the `@fonderie/config` admin screens, as a sub-page |
| Messaging | Templates | the `@fonderie/courier` admin screens, as a sub-page |
| Activity | Admin log · Access | who did what · who can be here |

```ts
import { AdminClient, AuthAdminClient, BillingAdminClient, ConfigAdminClient, CourierAdminClient } from '@fonderie/client';
import { AdminShell } from '@fonderie/vue-admin-screens';

const base = { baseUrl: 'https://api.example.com', adminToken, actor: 'louis' };
const client = new AdminClient(base);
// prefix: the composed surface under /_admin — one token for everything.
const configClient = new ConfigAdminClient({ ...base, prefix: '/_admin' });
const courierClient = new CourierAdminClient({ ...base, prefix: '/_admin' });
const authClient = new AuthAdminClient(base); // @fonderie/auth ≥ 7.8
const billingClient = new BillingAdminClient(base); // @fonderie/billing ≥ 9.10
```

```ts
h(AdminShell, { client, configClient, courierClient, authClient, billingClient })
```

Pass `page` and listen to `navigate` to own the URL (one route per page);
omit `page` and the shell keeps it itself. Settings and Messaging appear only
when their client is given.

Nothing here stores the token: the app constructs the clients and decides
where the token lives. Every request through the shell lands in the admin
log, including the ones the token refuses.
