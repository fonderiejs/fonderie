# @fonderie/events

The event bus wiring the bricks together: publish domain events, subscribe
with wildcard patterns, and swap transports without touching handlers.
Memory and PostgreSQL transports built in.

## Install

```sh
npm install @fonderie/events
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { EventsModule } from '@fonderie/events';

const app = await new FonderieApp(defineConfig({}))
  .register(new EventsModule())
  .boot();
```

```ts
import { EventBus, matchesPattern, NOTIFICATION_EVENT } from '@fonderie/events';
```

Domain packages export typed `EVENT_KEYS`; alias them on import
(`import { EVENT_KEYS as AUTH_EVENTS } from '@fonderie/auth'`) and
subscribe to exactly the events you care about.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how the bricks talk. The publish/subscribe backbone that lets
producers and consumers stay decoupled — swap transports, keep handlers.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
