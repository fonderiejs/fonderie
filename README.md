```
███████╗ ██████╗ ███╗   ██╗██████╗ ███████╗██████╗ ██╗███████╗
██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔════╝██╔══██╗██║██╔════╝
█████╗  ██║   ██║██╔██╗ ██║██║  ██║█████╗  ██████╔╝██║█████╗
██╔══╝  ██║   ██║██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗██║██╔══╝
██║     ╚██████╔╝██║ ╚████║██████╔╝███████╗██║  ██║██║███████╗
╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝
```

# Fonderie SDK

**The SaaS backend skill for AI coding assistants.** Every LLM asked to
build a SaaS invents its own auth, its own billing wiring, its own
permission model — different biases every session, security decisions
nobody audits, thousands of tokens burned on boilerplate instead of your
product. Fonderie replaces all of that with one mold: auth, workspaces,
billing, messaging, permissions, events — each a pre-built, reviewable
brick that snaps into `@fonderie/core`, each running in **your** process
against **your** database. Install the skill and any assistant — Claude
Code, Cursor, Codex, Gemini CLI — stops reinventing infrastructure and
starts building your actual product on a backend it already knows.

The bet is the same one HTTP made: standardize the boring parts — the
web has GET, POST, and a 404 nobody re-argues; the SaaS backend never
got its equivalent. Twenty years of engineering keeps re-deriving auth,
API shape, and schema from scratch, re-shipping the same security
flaws — and LLMs made that faster, not better. Faster horses. Fonderie
is the engine: one open, audited standard for the parts every product
shares, so founders spend themselves on operations — the only part
that's actually theirs.

Works the same without an LLM: it's plain TypeScript packages. Take one
brick or the whole set. What founders cast here is theirs. No seats, no
rent.

## The skill

This repo ships a [Claude Code skill](.claude/skills/fonderie/SKILL.md)
that teaches an assistant to reach for `@fonderie/*` bricks instead of
hand-writing auth, billing, or permissions. Working inside this repo (or
any repo that vendors the skill), it loads automatically — say "add
subscriptions" and the assistant wires `@fonderie/billing` instead of
improvising Stripe glue.

The skill is three files with a strict generated/curated split:

| File | Role | Maintained by |
| --- | --- | --- |
| [`SKILL.md`](.claude/skills/fonderie/SKILL.md) | When to reach for which brick; composition rules of thumb | hand |
| [`API.md`](.claude/skills/fonderie/API.md) | Curated wiring guide: the `buildFonderie()` golden example, registered routes, adapter mounts | hand |
| [`SIGNATURES.md`](.claude/skills/fonderie/SIGNATURES.md) | Exact public API of every package — constructors, config interfaces, exports | **generated — never edit** |

## Quickstart

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

Already on Express, Hono, or Koa? The adapter bricks
(`adapter-express`, `adapter-hono`, `adapter-koa`) mount Fonderie inside
your existing app instead.

## The bricks

| Package | What it is |
|---|---|
| [`@fonderie/adapter-express`](packages/adapter-express) | Express adapter for fonderie-js |
| [`@fonderie/adapter-hono`](packages/adapter-hono) | Hono adapter for fonderie-js |
| [`@fonderie/adapter-koa`](packages/adapter-koa) | Koa adapter for fonderie-js |
| [`@fonderie/audit`](packages/audit) | Workspace-scoped audit log |
| [`@fonderie/auth`](packages/auth) | Drop-in auth for SaaS |
| [`@fonderie/billing`](packages/billing) | SaaS billing in one module |
| [`@fonderie/client`](packages/client) | Isomorphic TypeScript client for Fonderie-powered APIs |
| [`@fonderie/config`](packages/config) | DB-backed feature flags and remote config |
| [`@fonderie/core`](packages/core) | Framework core |
| [`@fonderie/courier`](packages/courier) | Transactional messaging for SaaS |
| [`@fonderie/customers`](packages/customers) | Workspace-scoped customer records |
| [`@fonderie/events`](packages/events) | Event bus for @fonderie-js |
| [`@fonderie/logger`](packages/logger) | Structured logger with pluggable transports, child loggers, and a request-logging middleware |
| [`@fonderie/permissions`](packages/permissions) | Role-based access control for SaaS |
| [`@fonderie/rate-limit`](packages/rate-limit) | Distributed token-bucket rate limiting (memory/Postgres/Redis) |
| [`@fonderie/store`](packages/store) | Database abstraction layer |
| [`@fonderie/webhooks`](packages/webhooks) | Outgoing webhook engine |
| [`@fonderie/workspaces`](packages/workspaces) | Multi-tenant team layer |

## Development

```sh
npm install
npm run build              # build all workspaces
npm test                   # run all tests
npm run docs:signatures    # regenerate the skill's API reference from source
```

**Changed any package's public surface?** (new export, endpoint, config
field, constructor parameter) — run `npm run docs:signatures` and commit the
updated `.claude/skills/fonderie/SIGNATURES.md` alongside your change. The
generator extracts signatures from `src/` with the TypeScript checker and its
output is deterministic, so CI can enforce freshness:

```sh
npm run docs:signatures && git diff --exit-code .claude/skills/fonderie/SIGNATURES.md
```

Route tables and the wiring example in `API.md` are curated by hand — update
them when a module gains or changes an endpoint.

Releases are cut with [changesets](https://github.com/changesets/changesets):
`npx changeset` → `npm run release`.

[fonderiejs.com](https://fonderiejs.com) · follow [@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
