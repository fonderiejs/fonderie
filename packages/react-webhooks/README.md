# @fonderie/react-webhooks

React hooks for Fonderie's webhooks module — `useWebhookEndpoints` (list,
create, delete), `useWebhookEndpoint` (get, update), `useWebhookDeliveries`
(delivery history), and `useTestWebhookEndpoint` (send a test event). Thin
bindings over [`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-webhooks
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useWebhookEndpoints } from '@fonderie/react-webhooks';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Webhooks() {
  const { endpoints, isLoading, createEndpoint, removeEndpoint } = useWebhookEndpoints(client.webhooks);

  return (
    <ul>
      {endpoints.map((e) => (
        <li key={e.id}>
          {e.url} <button onClick={() => removeEndpoint(e.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

These hooks take the same `WebhooksClient` instance (`client.webhooks`) —
construct one `FonderieClient` at the app root and pass it down (React
context or a prop). The client's access token is shared with `client.auth`
automatically, so signing in via
[`@fonderie/react-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/react-auth)
is enough to authenticate webhook requests too. Requests default to the
caller's personal workspace until you call `client.webhooks.setWorkspaceId(id)`
to scope them to a team, same as `client.billing`/`client.workspaces`.

`createEndpoint` returns the endpoint's signing secret — it's only ever
returned at creation time, so surface it to the user immediately and don't
expect to fetch it again later.

Want a pre-built screen instead of wiring your own endpoint manager?
See [`@fonderie/react-webhooks-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/react-webhooks-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for webhook endpoints — state
management around `@fonderie/client`, nothing more. No business logic lives
here; it lives in `@fonderie/webhooks` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
