# @fonderie/react-auth

React hooks for Fonderie auth — `useLogin`, `useRegister`, `useSession`,
`useLogout`, `useForgotPassword`, `useResetPassword`, and `useVerifyEmail`.
Thin bindings over [`@fonderie/client`](https://github.com/fonderiejs/sdk/tree/main/packages/client):
loading/error state and the request itself, nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/react-auth
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { useLogin, useSession } from '@fonderie/react-auth';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function LoginForm() {
  const { login, isLoading, error } = useLogin(client.auth);

  return (
    <button
      disabled={isLoading}
      onClick={() => login({ email, password })}
    >
      {isLoading ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

function Profile() {
  const { user, isAuthenticated, logout } = useSession(client.auth);
  if (!isAuthenticated) return null;
  return <button onClick={logout}>Log out {user?.email}</button>;
}
```

Each hook takes the same `AuthClient` instance (`client.auth`) — construct one
`FonderieClient` at the app root and pass it down (React context or a prop).
The access token is persisted to `localStorage` and restored automatically by
`useSession` on mount; don't re-implement that in app code.

Want pre-built screens instead of wiring your own form?
See [`@fonderie/react-auth-screens`](https://github.com/fonderiejs/sdk/tree/main/packages/react-auth-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the React binding for auth — state management around
`@fonderie/client`, nothing more. No business logic lives here; it lives in
`@fonderie/auth` on the server.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
