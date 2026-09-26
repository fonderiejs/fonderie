# @fonderie/permissions

Role-based access control: define roles, assign CRUD permissions per
resource, and enforce them with middleware — the brick between "logged in"
and "allowed to".

## Install

```sh
npm install @fonderie/permissions
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { PermissionsModule } from '@fonderie/permissions';

const store = new PGAdapter(process.env.DATABASE_URL!);

const app = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
  .register(new PermissionsModule(store))
  .boot();
```

```ts
import { requirePermission, requireRole, OPERATIONS } from '@fonderie/permissions';
```

`PermissionsEngine` evaluates keys like `projects:update`; denials raise a
typed `PermissionDeniedError`.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** what the caller may do. Role and permission evaluation layered
on auth and workspaces, enforced at the route with one middleware.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
