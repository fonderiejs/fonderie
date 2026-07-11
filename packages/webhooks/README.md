# @fonderie-js/webhooks

Outgoing webhooks: let your users register endpoints, fan workspace events
out to them, and track every delivery attempt with retries and status.

## Install

```sh
npm install @fonderie-js/webhooks
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie-js/core';
import { WebhooksModule } from '@fonderie-js/webhooks';

const app = await new FonderieApp(defineConfig({}))
  .register(new WebhooksModule())
  .boot();
```

```ts
import type { IWebhookEndpoint, IWebhookDelivery, DeliveryStatus } from '@fonderie-js/webhooks';
```

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how the outside world listens. Your users register endpoints;
this brick fans workspace events out to them and tracks every delivery.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
