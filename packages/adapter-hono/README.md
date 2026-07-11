# @fonderie-js/adapter-hono

Run Fonderie bricks inside your existing Hono app. `bridge()` builds the
Fonderie context for every request, `adapt()` converts any Fonderie
middleware into a native Hono one, and `mount()` attaches whole modules.

## Install

```sh
npm install @fonderie-js/adapter-hono
```

## Use

```ts
import { bridge, adapt, requireAuth } from '@fonderie-js/adapter-hono';
```

Register `bridge(fonderie)` as global middleware first, then use the
re-exported guards (`requireAuth`, `requireWorkspace`, `requirePermission`,
`requireFeature`) directly on routes.

`ContextVariableMap` is augmented so `c.get('_fonderie')` is fully typed;
`FonderieVariables` is exported for typing your `Hono` instance.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
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
