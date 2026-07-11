# @fonderie/config

DB-backed feature flags and remote config: per-environment overrides and
TTL-cached snapshots, changeable at runtime without a deploy.

## Install

```sh
npm install @fonderie/config
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { RemoteConfigModule } from '@fonderie/config';

const app = await new FonderieApp(defineConfig({}))
  .register(new RemoteConfigModule())
  .boot();
```

```ts
import { configContextMiddleware, getConfig } from '@fonderie/config';
```

CRUD services (`listConfigEntries`, `setConfigEntry`, …) are exported for
building an admin surface on top.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how behavior changes without a deploy. Feature flags and remote
config read live by the other bricks.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
