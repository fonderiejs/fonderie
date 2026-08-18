# @fonderie/react-native-auth

React Native hooks for Fonderie auth — `useLogin`, `useRegister`,
`useSession`, `useLogout`, `useForgotPassword`, `useResetPassword`, and
`useVerifyEmail`. Same shape as
[`@fonderie/react-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth),
with the access token persisted to `AsyncStorage` instead of `localStorage`.

## Install

```sh
npm install @fonderie/react-native-auth @react-native-async-storage/async-storage
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useLogin, useSession } from '@fonderie/react-native-auth';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function LoginScreen() {
  const { login, isLoading, error } = useLogin(client.auth);

  return (
    <TouchableOpacity disabled={isLoading} onPress={() => login({ email, password })}>
      <Text>{isLoading ? 'Signing in…' : 'Sign in'}</Text>
    </TouchableOpacity>
  );
}

function Profile() {
  const { user, isAuthenticated, logout } = useSession(client.auth);
  if (!isAuthenticated) return null;
  return <TouchableOpacity onPress={logout}><Text>Log out {user?.email}</Text></TouchableOpacity>;
}
```

Each hook takes the same `AuthClient` instance (`client.auth`) — construct one
`FonderieClient` at the app root and pass it down (React context or a prop).
The access token is persisted to `AsyncStorage` and restored automatically by
`useSession` on mount; don't re-implement that in app code.

Want pre-built screens instead of wiring your own form?
See [`@fonderie/react-native-auth-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-native-auth-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React Native binding for auth — state management
around `@fonderie/client`, nothing more. No business logic lives here; it
lives in `@fonderie/auth` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
