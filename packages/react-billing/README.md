# @fonderie/react-billing

React hooks for Fonderie billing — `usePlans`, `usePlan`, `useSubscription`,
`useCheckout`, `useBillingPortal`, `useUsage`, `useRecordUsage`, and in-app
card management (`usePaymentMethod`, `useSetupPaymentMethod`,
`useSavePaymentMethod`, `useRemovePaymentMethod`), and `usePurchasePack` (buy a
credit pack by charging the saved card — no redirect). Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-billing
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
const { ...state } = usePlans();
```

Passing a client explicitly (as below) still works everywhere and takes
precedence over context — handy in tests and multi-client apps.

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
[`@fonderie/react-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth)
is enough to authenticate billing requests too. Billing by workspace instead
of by user? Call `client.billing.setWorkspaceId(id)`.

### Manage a card in-app (no redirect)

Let users add a card without leaving the site. `useSetupPaymentMethod` returns
a provider SetupIntent client secret you hand to a Stripe Payment Element;
after it confirms client-side, `useSavePaymentMethod` records the card as the
default. `usePaymentMethod` reads the card on file and `useRemovePaymentMethod`
detaches it.

```tsx
import { useSetupPaymentMethod, useSavePaymentMethod } from '@fonderie/react-billing';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

// 1. start the SetupIntent, mount <Elements> with its clientSecret, then:
const { save } = useSavePaymentMethod();
const stripe = useStripe();
const elements = useElements();

const { setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
await save(setupIntent.payment_method); // records it as the default
```

The Payment Element and the publishable key live in your app (a generic
package can't own them). See the fully-wired reference in
[`examples/leadeasygen`](https://github.com/fonderiejs/sdk/tree/main/examples).

Want pre-built screens instead of wiring your own pricing table?
See [`@fonderie/react-billing-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-billing-screens) —
its `SubscriptionScreen` shows and removes the card and delegates add/update
via an `onAddPaymentMethod` prop.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for billing — state management
around `@fonderie/client`, nothing more. No business logic lives here; it
lives in `@fonderie/billing` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
