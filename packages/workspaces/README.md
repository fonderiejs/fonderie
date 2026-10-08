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

### Emails, phones and locations

A business is reached in more than one way and works from more than one
place. `GET /workspaces/contacts` (any member) lists its emails, phones and
locations; owners and managers add and change them under `/workspaces/emails`,
`/workspaces/phones` and `/workspaces/locations` (archive / restore — never
delete a location). One email and one phone are primary, one location is the
head office; the first added takes the flag, and setting it on another moves
it. The workspace's own `email`, `phone` and `address` mirror the primary
email, the primary phone and the head office's address — a `PUT /workspaces`
with any of them updates the entries too, in the same transaction. Phones are
E.164 (`+15145550100`, optional `extension`); a location's `taxRegion`
(`CA-QC`) comes from its address unless given. Limits: 10 emails, 10 phones,
50 locations. Frontend: `useWorkspaceContacts()` and `useWorkspaceLocations()`
in the React, React Native and Vue workspaces packages.

### Archiving: read-only until restored

`POST /workspaces/archive` and `POST /workspaces/restore` are the owner's
alone. An archived workspace is **read-only**: every write route of this brick
answers `409 WORKSPACE_ARCHIVED`, invitations cannot be accepted, while reads
keep working so its data can be exported. Leaving it and handing it over
(`/workspaces/transfer-ownership…`) still work. `isArchived` / `archivedAt` are
on every workspace DTO (`GET /workspaces`, `GET /workspaces/current`).

Other bricks and your own routes honour it too: `withWorkspace` sets
`ctx.meta['fonderie.workspaces.archived']` (`true` / `false`) on every request
it resolves — read it by shape with no dependency — or put the exported
`requireActiveWorkspace()` after `withWorkspace` on your write routes.

Archiving and restoring emit `fonderie.workspace.archived` /
`fonderie.workspace.restored` (`{ workspaceId, userId }`). `@fonderie/billing`
can follow them — opt in with `onWorkspaceArchived: 'cancel-at-period-end'`:
an archived workspace's subscription then ends at the period's end, and
restoring it before then resumes it. By default billing is left as it was.

### Seats, system-role grants, paging

- `GET /workspaces/seats` (any member) → `{ used, members, pendingInvites,
  limit, available }`: `used` is what the plan's seat limit is checked against
  when inviting (the team without the owner, plus pending invitations);
  `limit` is `null` without one. Frontend: `useWorkspaceSeats()`.
- `GET /workspaces/permissions/catalog` also returns `systemGrants` — what
  each system role (`GUEST`, …) may do by `@fonderie/permissions`'
  `systemGrants` config (role → resource → operations) — so a role editor
  shows them instead of hard-coding them.
- `GET /workspaces/members` and `GET /workspaces/invitations` take optional
  `?limit=&cursor=` and then answer a page plus `nextCursor` (null on the last
  page); without them they return the whole list, as before. Hooks:
  `useMembers(client, { pageSize })` / `useInvitations(client, { pageSize })`
  with `loadMore` / `hasMore`.

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
