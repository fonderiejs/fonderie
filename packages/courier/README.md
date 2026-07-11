# @fonderie/courier

Transactional messaging: one brick that delivers email, SMS, and push
through pluggable channels, with templates resolved from the database or
the filesystem and every send logged.

## Install

```sh
npm install @fonderie/courier
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { CourierModule } from '@fonderie/courier';

const app = await new FonderieApp(defineConfig({}))
  .register(new CourierModule())
  .boot();
```

```ts
import { EmailChannel, SmsChannel, PushChannel, DBTemplateResolver } from '@fonderie/courier';
```

Delivery webhooks for SendGrid, Mailgun, and Mailtrap are handled by the
exported `handle*Delivery` functions; `IMessageLog` tracks status per send.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how the product speaks to humans. Outbound email, SMS, and push
with templates and delivery logs — other bricks emit intents, this one
delivers them.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
