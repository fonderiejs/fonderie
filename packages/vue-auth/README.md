# @fonderie/vue-auth

Vue 3 composables for Fonderie auth — `useLogin`, `useRegister`,
`useSession`, `useLogout`, `useForgotPassword`, `useResetPassword`, and
`useVerifyEmail`. Thin bindings over
[`@fonderie/client`](https://github.com/fonderie-js/sdk/tree/main/packages/client):
reactive `ref`s for loading/error/data state and the request itself, nothing
else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-auth
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { useLogin, useSession } from '@fonderie/vue-auth';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
const { login, isLoading, error } = useLogin(client.auth);
const { user, isAuthenticated, logout } = useSession(client.auth);
</script>

<template>
  <button :disabled="isLoading" @click="login({ email, password })">
    {{ isLoading ? 'Signing in…' : 'Sign in' }}
  </button>
  <button v-if="isAuthenticated" @click="logout">Log out {{ user?.email }}</button>
</template>
```

Each composable takes the same `AuthClient` instance (`client.auth`) —
construct one `FonderieClient` at the app root and pass it down (provide/inject
or a prop). The access token is persisted to `localStorage` and restored
automatically by `useSession` on setup; don't re-implement that in app code.

Want pre-built screens instead of wiring your own form?
See [`@fonderie/vue-auth-screens`](https://github.com/fonderie-js/sdk/tree/main/packages/vue-auth-screens).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the Vue binding for auth — reactive state management
around `@fonderie/client`, nothing more. No business logic lives here; it
lives in `@fonderie/auth` on the server.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
