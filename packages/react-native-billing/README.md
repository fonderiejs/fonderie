# @fonderie/react-native-billing

React Native billing hooks for Fonderie — re-exports
[`@fonderie/react-billing`](https://github.com/fonderiejs/sdk/tree/main/packages/react-billing)
wholesale. Unlike auth, billing hooks own no storage of their own (they read
the access token `@fonderie/auth` already set on the shared client), so
there's no platform-specific code to fork — the same `usePlans`,
`usePlan`, `useSubscription`, `useCheckout`, `useBillingPortal`, `useUsage`,
and `useRecordUsage` hooks work in React Native as-is.

## Install

```sh
npm install @fonderie/react-native-billing
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { usePlans, useCheckout } from '@fonderie/react-native-billing';
import { Linking } from 'react-native';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function Pricing() {
  const { plans } = usePlans(client.billing);
  const { checkout } = useCheckout(client.billing);

  return (
    <>
      {plans.map((plan) => (
        <TouchableOpacity
          key={plan.id}
          onPress={async () => Linking.openURL(await checkout({ plan: plan.name }))}
        >
          <Text>{plan.name}</Text>
        </TouchableOpacity>
      ))}
    </>
  );
}
```

Want pre-built screens instead of wiring your own pricing table?
See [`@fonderie/react-native-billing-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-billing-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** making `@fonderie/react-billing`'s hooks installable
under the React Native naming convention, so an agent or developer looking
for "billing hooks for my Expo app" finds them without having to know the
hooks happen to be framework-agnostic under the hood.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
