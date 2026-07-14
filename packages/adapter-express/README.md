# @fonderie/adapter-express

Run Fonderie bricks inside your existing Express app. `bridge()` builds the
Fonderie context for every request, `adapt()` converts any Fonderie
middleware into a native Express one, and `mount()` attaches whole modules.

## Install

```sh
npm install @fonderie/adapter-express
```

## Use

```ts
import express from 'express';
import { mount, requireAuth, withWorkspace, type ExpressRequest } from '@fonderie/adapter-express';
import { buildFonderie } from './fonderie'; // your FonderieApp — see @fonderie/core

const { fonderie, store } = await buildFonderie();

const app = express();
app.use(express.json());

// mount() registers bridge() for you and seals fonderie's infra routes
// lazily at app.listen() — add your own routes in between.
mount(app, fonderie);

app.get('/jobs', requireAuth, withWorkspace(store), (req, res) => {
  const ctx = (req as ExpressRequest)._fonderie!;
  res.json({ user: ctx.user, workspace: ctx.workspace });
});

app.listen(3000);
```

The guards `withWorkspace`, `requirePermission`, and `requireFeature` load
their peer package lazily on first request — install `@fonderie/workspaces`,
`@fonderie/permissions`, or `@fonderie/billing` only if you use the matching
guard. For custom Fonderie middleware, wrap it with `adapt()`;
`expressRequestToWeb` converts Express requests to web-standard `Request`
objects for the Fonderie pipeline.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the border crossing. It translates Express requests and
middleware conventions into Fonderie's, so the bricks run inside an app you
already have instead of demanding a rewrite.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
