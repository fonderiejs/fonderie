# @fonderie/react-audit

React hooks for Fonderie's audit log — `useAuditEvents` (cursor-paginated,
filterable by `type`/`actorId`/date range, with `loadMore`). Thin bindings
over [`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-audit
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useAuditEvents } from '@fonderie/react-audit';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function AuditLog() {
  const { events, isLoading, hasMore, loadMore } = useAuditEvents(client.audit, { type: 'workspace.updated' });

  return (
    <>
      <ul>{events.map((e) => <li key={e.id}>{e.type} — {e.createdAt}</li>)}</ul>
      {hasMore && <button onClick={loadMore}>Load more</button>}
    </>
  );
}
```

`useAuditEvents` takes the same `AuditClient` instance (`client.audit`) —
construct one `FonderieClient` at the app root and pass it down (React
context or a prop). The client's access token is shared with `client.auth`
automatically, so signing in via
[`@fonderie/react-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth)
is enough to authenticate audit requests too. Requests default to the
caller's personal workspace until you call
`client.audit.setWorkspaceId(id)` to scope them to a team, same as
`client.billing`/`client.workspaces`.

`@fonderie/audit` has one route, read-only — there's no create/update/delete
hook because there's no such endpoint; audit events are written internally
by other modules.

Want a pre-built screen instead of wiring your own log viewer?
See [`@fonderie/react-audit-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-audit-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for the audit log — state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/audit` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
