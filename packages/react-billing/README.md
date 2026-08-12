# @fonderie/react-billing

React hooks for Fonderie billing — `usePlans`, `usePlan`, `useSubscription`,
`useCheckout`, `useBillingPortal`, `useUsage`, and `useRecordUsage`. Thin
bindings over [`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-billing
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { usePlans, useCheckout, useSubscription } from '@fonderie/react-billing';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Pricing() {
  const { plans, isLoading } = usePlans(client.billing);
  const { checkout } = useCheckout(client.billing);

  return (
    <ul>
      {plans.map((plan) => (
        <li key={plan.id}>
          {plan.name}
          <button onClick={async () => { window.location.href = await checkout({ plan: plan.name }); }}>
            Choose
          </button>
        </li>
      ))}
    </ul>
  );
}

function Account() {
  const { subscription } = useSubscription(client.billing);
  return <p>Plan: {subscription?.plan ?? 'none'}</p>;
}
```

Each hook takes the same `BillingClient` instance (`client.billing`) —
construct one `FonderieClient` at the app root and pass it down (React
context or a prop). The client's access token is shared with `client.auth`
automatically, so signing in via
[`@fonderie/react-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/react-auth)
is enough to authenticate billing requests too. Billing by workspace instead
of by user? Call `client.billing.setWorkspaceId(id)`.

Want pre-built screens instead of wiring your own pricing table?
See [`@fonderie/react-billing-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/react-billing-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for billing — state management
around `@fonderie/client`, nothing more. No business logic lives here; it
lives in `@fonderie/billing` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
