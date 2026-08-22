# @fonderie/react-customers

React hooks for Fonderie's customers module (a workspace-scoped CRM) —
`useCustomers` (list/create/delete/blacklist), `useCustomer` (get/update),
and one combined hook per sub-resource: `useCustomerEmails`,
`useCustomerPhones`, `useCustomerAddresses`, `useCustomerNotes`,
`useCustomerTags`, `useCustomerRelationships`, `useCustomerLabels`. Thin
bindings over [`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-customers
```

## One client at the root (recommended)

Wrap your app in `FonderieProvider` from [`@fonderie/react`](../react) once and
every hook resolves the client from context — no client argument at call sites:

```tsx
import { FonderieProvider } from "@fonderie/react";

<FonderieProvider client={client}>
  <App />
</FonderieProvider>;

// anywhere below it:
const { ...state } = useCustomers();
```

Passing a client explicitly (as below) still works everywhere and takes
precedence over context — handy in tests and multi-client apps.

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useCustomers, useCustomerEmails } from '@fonderie/react-customers';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Customers() {
  const { customers, isLoading, createCustomer } = useCustomers(client.customers, { search: 'acme' });
  return (
    <ul>{customers.map((c) => <li key={c.id}>{c.firstName} {c.lastName}</li>)}</ul>
  );
}

function CustomerEmails({ customerId }: { customerId: string }) {
  const { emails, addEmail, removeEmail } = useCustomerEmails(client.customers, customerId);
  return (
    <ul>{emails.map((e) => <li key={e.id}>{e.email}</li>)}</ul>
  );
}
```

These hooks take the same `CustomersClient` instance (`client.customers`) —
construct one `FonderieClient` at the app root and pass it down (React
context or a prop). The client's access token is shared with `client.auth`
automatically, so signing in via
[`@fonderie/react-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth)
is enough to authenticate customer requests too. Requests default to the
caller's personal workspace until you call
`client.customers.setWorkspaceId(id)` to scope them to a team, same as
`client.billing`/`client.workspaces`/`client.webhooks`.

Only the label is editable on an existing email/phone/address — the value
itself is immutable once added; remove and re-add to change it. Matches
`@fonderie/customers`' controllers exactly. `useCustomerLabels` browses the
workspace's shared label vocabulary directly (new labels are otherwise
created implicitly by the `label` string passed to `addEmail`/`addPhone`/
`addAddress`).

Want a pre-built screen instead of wiring your own customer manager? See
[`@fonderie/react-customers-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-customers-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for customers — state management
around `@fonderie/client`, nothing more. No business logic lives here; it
lives in `@fonderie/customers` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
