# @fonderie/react-native-auth-screens

Pre-built React Native auth screens — `LoginScreen`, `RegisterScreen`, and
`ForgotPasswordScreen` — built on
[`@fonderie/react-native-auth`](https://github.com/fonderie-js/sdk/tree/main/packages/react-native-auth)
hooks. Native `View`/`TextInput`/`TouchableOpacity` components, inline styles
you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/react-native-auth-screens @react-native-async-storage/async-storage
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { LoginScreen } from '@fonderie/react-native-auth-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function App() {
  return (
    <LoginScreen
      client={client.auth}
      onLoginSuccess={({ user }) => console.log('signed in', user.email)}
      onNavigateToRegister={() => navigation.navigate('Register')}
      onNavigateToForgotPassword={() => navigation.navigate('ForgotPassword')}
    />
  );
}
```

Each screen wires a `useLogin`/`useRegister`/`useForgotPassword` hook from
`@fonderie/react-native-auth` internally — loading state, error display, and
`AsyncStorage` token persistence are already handled. Need just the state
management without the markup? Use `@fonderie/react-native-auth`'s hooks
directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React Native auth UI, so you don't have to
write a login screen from scratch. Swap it for your own design system
whenever you outgrow it — `@fonderie/react-native-auth`'s hooks work
standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
