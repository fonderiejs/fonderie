# @fonderie/adapter-hono

Run Fonderie bricks inside your existing Hono app. `bridge()` builds the
Fonderie context for every request, `adapt()` converts any Fonderie
middleware into a native Hono one, and `mount()` attaches whole modules.

## Install

```sh
npm install @fonderie/adapter-hono
```

## Use

```ts
import { Hono } from 'hono';
import { mount, bridge, requireAuth, withWorkspace } from '@fonderie/adapter-hono';
import { buildFonderie } from './fonderie'; // your FonderieApp — see @fonderie/core

const { fonderie, store } = await buildFonderie();

const hono = new Hono();

// bridge() populates c.get('_fonderie') for your routes; mount() registers
// fonderie's infra routes as the notFound fallback, so your routes win.
hono.use('*', bridge(fonderie));
mount(hono, fonderie);

hono.get('/jobs', requireAuth, withWorkspace(store), (c) => {
  const ctx = c.get('_fonderie');
  return c.json({ user: ctx.user, workspace: ctx.workspace });
});

export default hono;
```

The guards `withWorkspace`, `requirePermission`, and `requireFeature` load
their peer package lazily on first request — install `@fonderie/workspaces`,
`@fonderie/permissions`, or `@fonderie/billing` only if you use the matching
guard. For custom Fonderie middleware, wrap it with `adapt()`.
`ContextVariableMap` is augmented so `c.get('_fonderie')` is fully typed;
`FonderieVariables` is exported for typing your `Hono` instance.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the border crossing. It translates Hono contexts and
middleware conventions into Fonderie's, so the bricks run inside an app you
already have instead of demanding a rewrite.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
