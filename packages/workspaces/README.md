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
import { WorkspacesModule } from '@fonderie/workspaces';

const app = await new FonderieApp(defineConfig({}))
  .register(new WorkspacesModule())
  .boot();
```

Scope any route to the caller's workspace:

```ts
import { withWorkspace, requireWorkspace } from '@fonderie/workspaces';
```

DTO mappers (`toWorkspaceDTO`, `toMemberDTO`, `toInvitationDTO`, …) and
typed `EVENT_KEYS` are exported for your handlers and event consumers.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** who the caller belongs to. Tenancy, membership, invitations,
and role containers — the bricks scope their data by the workspace context
this one provides.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
