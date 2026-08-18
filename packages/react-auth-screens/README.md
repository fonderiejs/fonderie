# @fonderie/react-auth-screens

Pre-built React auth screens — `LoginScreen`, `RegisterScreen`, and
`ForgotPasswordScreen` — built on
[`@fonderie/react-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth)
hooks. Plain HTML form elements, inline styles you can override, zero UI
library dependency.

## Install

```sh
npm install @fonderie/react-auth-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { LoginScreen } from '@fonderie/react-auth-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function App() {
  return (
    <LoginScreen
      client={client.auth}
      onLoginSuccess={({ user }) => console.log('signed in', user.email)}
      onNavigateToRegister={() => setRoute('register')}
      onNavigateToForgotPassword={() => setRoute('forgot-password')}
    />
  );
}
```

Each screen wires a `useLogin`/`useRegister`/`useForgotPassword` hook from
`@fonderie/react-auth` internally — loading state, error display, and token
persistence are already handled. Need just the state management without the
markup? Use `@fonderie/react-auth`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React auth UI, so you don't have to write a
login form from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/react-auth`'s hooks work standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
