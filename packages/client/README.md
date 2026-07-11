# @fonderie-js/client

Isomorphic TypeScript client for Fonderie-powered APIs. Fully typed request
and response shapes end to end, zero runtime dependencies — works in the
browser, Node, and edge runtimes alike.

## Install

```sh
npm install @fonderie-js/client
```

## Use

```ts
import { FonderieClient, FonderieApiError } from '@fonderie-js/client';

const api = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

try {
  const { tokens } = await api.auth.login({ email, password });
  const user = await api.auth.getUser();
} catch (err) {
  if (err instanceof FonderieApiError) {
    // typed status, code, and message from the API's error envelope
  }
}
```

The client is organised into modules mirroring the server packages —
`api.auth` covers register/login/refresh, email verification, password reset,
phone OTP, profile updates, and MFA setup/verify/disable, with every DTO
(`IUserDTO`, `ITokens`, `ILoginResult`, …) exported for your own signatures.

Pairs with any API built on
[@fonderie-js/core](https://github.com/fonderie-js/sdk/tree/main/packages/core);
the types stay in lockstep because both sides live in the same monorepo.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the consumer side. Typed access to any Fonderie-powered API from
browser, Node, or edge — with request/response shapes that stay in lockstep
with the server because both live in this monorepo.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
