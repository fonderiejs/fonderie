# @fonderie/react-native-billing-screens

Pre-built React Native billing screens — `PricingScreen` and
`SubscriptionScreen` — built on
[`@fonderie/react-native-billing`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-billing)
hooks. Native `View`/`FlatList`/`TouchableOpacity` components, inline styles
you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/react-native-billing-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { PricingScreen, SubscriptionScreen } from '@fonderie/react-native-billing-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function PricingRoute() {
  return <PricingScreen client={client.billing} />;
}

function AccountRoute() {
  return (
    <SubscriptionScreen
      client={client.billing}
      onNavigateToPricing={() => navigation.navigate('Pricing')}
    />
  );
}
```

`PricingScreen` lists plans with a monthly/yearly toggle and starts Stripe
Checkout on choose. `SubscriptionScreen` shows the caller's current plan,
status, and renewal date, with a button into the Stripe billing portal. Both
default to opening the Stripe-hosted URL via `Linking.openURL` — pass
`onCheckoutStart` / `onManageBilling` to handle navigation yourself (e.g. an
in-app WebView). Need just the state management without the markup? Use
`@fonderie/react-native-billing`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React Native billing UI, so you don't have
to build a pricing screen from scratch. Swap it for your own design system
whenever you outgrow it — `@fonderie/react-native-billing`'s hooks work
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
