# @fonderie/workspaces

The multi-tenant team layer: workspaces, members, invitations, and custom
roles — the brick that turns a single-user API into a product teams share.

## Install

```sh
npm install @fonderie/workspaces
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { WorkspacesModule } from '@fonderie/workspaces';

const store = new PGAdapter(process.env.DATABASE_URL!);

const app = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
  .register(new WorkspacesModule(store))
  .boot();
```

Scope any route to the caller's workspace:

```ts
import { withWorkspace, requireWorkspace } from '@fonderie/workspaces';
```

DTO mappers (`toWorkspaceDTO`, `toMemberDTO`, `toInvitationDTO`, …) and
typed `EVENT_KEYS` are exported for your handlers and event consumers.

### The business profile

`PUT /workspaces` (owner / managers) holds what a quote, an invoice or a
customer email needs: name, motto, legal form, `industry` (your app's own
sector key, e.g. `'plumbing'`), phone, email, website, logo, address (with
`line2` for the unit and `accessCode` for a buzzer or door code) and
`taxRegistrations` — each with a `number`, a `rate` (percent, e.g. `9.975`),
or both, checked against the country's rules. `PUT /workspaces/settings`
adds `documentPrefixes`, e.g. `{ invoice: 'ACME', job: 'ACME-JOB' }`, for
apps that print a prefix before a document's number. A refusal is a 422
naming the field: `taxRegistrations.1.rate: …`.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** who the caller belongs to. Tenancy, membership, invitations,
and role containers — the bricks scope their data by the workspace context
this one provides.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
