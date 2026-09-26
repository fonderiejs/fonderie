# @fonderie/audit

The paper trail: query the platform's event log as a human-readable,
workspace-scoped activity feed. If a brick emitted it, this brick can
show it.

## Install

```sh
npm install @fonderie/audit
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { AuditModule } from '@fonderie/audit';

const store = new PGAdapter(process.env.DATABASE_URL!);

const app = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
  .register(new AuditModule(store))
  .boot();
```

```ts
import type { IAuditQuery, IAuditPageDTO } from '@fonderie/audit';
```

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what happened. It reads the platform's event log back as a
human-readable, workspace-scoped activity trail.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
