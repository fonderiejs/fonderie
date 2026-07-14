# @fonderie/adapter-koa

Run Fonderie bricks inside your existing Koa app. `bridge()` builds the
Fonderie context for every request, `adapt()` converts any Fonderie
middleware into a native Koa one, and `mount()` attaches whole modules.

## Install

```sh
npm install @fonderie/adapter-koa
```

## Use

```ts
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import Router from '@koa/router';
import { mount, requireAuth, withWorkspace } from '@fonderie/adapter-koa';
import { buildFonderie } from './fonderie'; // your FonderieApp — see @fonderie/core

const { fonderie, store } = await buildFonderie();

const app = new Koa();
app.use(bodyParser()); // must run first so rawBody is populated

// mount() builds the fonderie context for every request and falls back to
// fonderie's infra routes when no user route handled the request.
mount(app, fonderie);

const router = new Router();
router.get('/jobs', requireAuth, withWorkspace(store), (ctx) => {
  const f = ctx.state._fonderie;
  ctx.body = { user: f.user, workspace: f.workspace };
});
app.use(router.routes());

app.listen(3000);
```

The guards `withWorkspace`, `requirePermission`, and `requireFeature` load
their peer package lazily on first request — install `@fonderie/workspaces`,
`@fonderie/permissions`, or `@fonderie/billing` only if you use the matching
guard. For custom Fonderie middleware, wrap it with `adapt()`.
`koaContextToWeb` converts Koa contexts to web-standard `Request` objects
for the Fonderie pipeline.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the border crossing. It translates Koa contexts and
middleware conventions into Fonderie's, so the bricks run inside an app you
already have instead of demanding a rewrite.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
