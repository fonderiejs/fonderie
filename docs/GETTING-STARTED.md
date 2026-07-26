# Getting started

A hands-on guide to standing up a Fonderie backend. For the *why*, read
[`../README.md`](../README.md); for the canonical reference an assistant
reads before writing code, see [`../FONDERIE.md`](../FONDERIE.md).

Every brick runs **in your process, against your database** — there is
no Fonderie server. You compose the bricks you want and boot them into a
single HTTP handler.

## 1. Install

Start with the core plus whichever bricks you need:

```bash
npm install @fonderie/core @fonderie/auth @fonderie/workspaces
```

Every package is published under the `@fonderie` scope and is plain
TypeScript — take one brick or the whole set.

## 2. Boot your first app

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { AuthModule } from '@fonderie/auth';
import { WorkspacesModule } from '@fonderie/workspaces';

const app = await new FonderieApp(defineConfig({ basePath: '/v1' }))
  .register(new AuthModule())
  .register(new WorkspacesModule())
  .boot();

app.listen(3000, { name: 'my-api' });
```

`register()` adds a brick; `boot()` installs each module and returns one
HTTP handler. Register only what you need — add more bricks as the
product grows.

## 3. Add more bricks

Composition is the whole model: install the package, register the
module, boot. For example, to add billing and role-based permissions:

```bash
npm install @fonderie/billing @fonderie/permissions
```

```ts
import { BillingModule } from '@fonderie/billing';
import { PermissionsModule } from '@fonderie/permissions';

// …
  .register(new BillingModule())
  .register(new PermissionsModule())
```

See [The bricks](../README.md#the-bricks) for the full catalogue. Each
package has its own README with configuration and usage specifics.

## 4. Already have a server?

If you're on Express, Hono, or Koa, mount Fonderie inside your existing
app with an adapter brick instead of calling `listen()`:

- [`@fonderie/adapter-express`](../packages/adapter-express)
- [`@fonderie/adapter-hono`](../packages/adapter-hono)
- [`@fonderie/adapter-koa`](../packages/adapter-koa)

## 5. Call it from a client

[`@fonderie/client`](../packages/client) is an isomorphic TypeScript
client for a Fonderie-powered API — use it from your web app, a script,
or another service to talk to the endpoints your bricks expose.

## Where to go next

| I want to… | Read |
| --- | --- |
| See every brick and what it does | [README → The bricks](../README.md#the-bricks) |
| Understand the architecture | [docs/README.md](README.md) |
| Give an AI assistant the SDK skill | [.claude/skills/fonderie/SKILL.md](../.claude/skills/fonderie/SKILL.md) |
| Configuration & usage for a specific brick | that package's `README.md` under [`packages/`](../packages) |
