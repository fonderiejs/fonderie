# @fonderie-js/audit

The paper trail: query the platform's event log as a human-readable,
workspace-scoped activity feed. If a brick emitted it, this brick can
show it.

## Install

```sh
npm install @fonderie-js/audit
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie-js/core';
import { AuditModule } from '@fonderie-js/audit';

const app = await new FonderieApp(defineConfig({}))
  .register(new AuditModule())
  .boot();
```

```ts
import type { IAuditQuery, IAuditPageDTO } from '@fonderie-js/audit';
```

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what happened. It reads the platform's event log back as a
human-readable, workspace-scoped activity trail.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
