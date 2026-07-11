# @fonderie-js/core

The framework core every other `@fonderie-js` package builds on: a web-standard
request router, a composable middleware pipeline, a module system, and the
shared `IFonderieContext` that flows through all of it.

You can run it standalone — `FonderieApp` includes a Node HTTP server — or
mount it inside an existing Express, Hono, or Koa app via the adapter packages.

## Install

```sh
npm install @fonderie-js/core
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie-js/core';

const app = new FonderieApp(defineConfig({ basePath: '/v1' }));
app.listen(3000, { name: 'my-api' });
```

Built-in middlewares (CORS, request logging, auth guards, body parsing) live
under their own entry point so the root barrel stays lean:

```ts
import { cors, requireAuth } from '@fonderie-js/core/middlewares';
```

Also exported: `compose` for middleware composition, `HTTP`/`setApiResponse`
response helpers, and defensive parsers (`stringOrEmpty`, `numberOrZero`, …)
for untrusted input.

## The module system

Feature packages — [auth](https://github.com/fonderie-js/sdk/tree/main/packages/auth),
[workspaces](https://github.com/fonderie-js/sdk/tree/main/packages/workspaces),
[billing](https://github.com/fonderie-js/sdk/tree/main/packages/billing),
[courier](https://github.com/fonderie-js/sdk/tree/main/packages/courier), and
friends — implement `IFonderieModule` and register their routes, migrations,
and event handlers against this core. Pick the modules your product needs;
skip the rest.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the contract. The router, middleware pipeline, request context, and
module lifecycle every other brick builds against. It depends on nothing;
everything depends on it.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
