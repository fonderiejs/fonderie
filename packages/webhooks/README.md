# @fonderie/webhooks

Outgoing webhooks: let your users register endpoints, fan workspace events
out to them, and track every delivery attempt with retries and status.

## Install

```sh
npm install @fonderie/webhooks @fonderie/workspaces
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { WebhooksModule } from '@fonderie/webhooks';

const store = new PGAdapter(process.env.DATABASE_URL!);

const app = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
  .register(new WebhooksModule(store))
  .boot();
```

```ts
import type { IWebhookEndpoint, IWebhookDelivery, DeliveryStatus } from '@fonderie/webhooks';
```

### Who can manage endpoints

Endpoints belong to a workspace. Every `/webhooks` route resolves it from the
`X-Workspace-ID` header (or the caller's personal workspace) and checks
membership, then requires a **manager**: the workspace owner or a holder of a
manager role (default `ADMIN`). An endpoint receives every event of its
workspace and its secret signs them, so it is an integration setting, not a
member preference. Plain members get `403 MANAGER_REQUIRED`.

The knobs are the same as `@fonderie/workspaces`:

```ts
new WebhooksModule(store, { managerRoles: ['ADMIN', 'INTEGRATIONS'] });
new WebhooksModule(store, { management: 'any-member' }); // flat teams: every member manages
```

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how the outside world listens. Your users register endpoints;
this brick fans workspace events out to them and tracks every delivery.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
