# @fonderie/vue-auth-screens

Pre-built Vue 3 auth screens — `LoginScreen`, `RegisterScreen`, and
`ForgotPasswordScreen` — built on
[`@fonderie/vue-auth`](https://github.com/fonderiejs/sdk/tree/main/packages/vue-auth)
composables. Plain HTML form elements via Vue's `h()` render function, inline
styles you can override, zero UI library dependency.

## Install

```sh
npm install @fonderie/vue-auth-screens
```

## Use

```vue
<script setup>
import { FonderieClient } from '@fonderie/client';
import { LoginScreen } from '@fonderie/vue-auth-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });
</script>

<template>
  <LoginScreen
    :client="client.auth"
    @login-success="({ user }) => console.log('signed in', user.email)"
    @navigate-register="route = 'register'"
    @navigate-forgot-password="route = 'forgot-password'"
  />
</template>
```

Each screen wires a `useLogin`/`useRegister`/`useForgotPassword` composable
from `@fonderie/vue-auth` internally — loading state, error display, and
token persistence are already handled. Need just the state management
without the markup? Use `@fonderie/vue-auth`'s composables directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built Vue auth UI, so you don't have to write a
login form from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/vue-auth`'s composables work standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
