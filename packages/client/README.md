# @fonderie/client

Isomorphic TypeScript client for Fonderie-powered APIs. Fully typed request
and response shapes end to end, zero runtime dependencies — works in the
browser, Node, and edge runtimes alike.

## Install

```sh
npm install @fonderie/client
```

## Use

```ts
import { FonderieClient, FonderieApiError } from '@fonderie/client';

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
[@fonderie/core](https://github.com/fonderiejs/fonderie/tree/main/packages/core);
the types stay in lockstep because both sides live in the same monorepo.

## Realtime and offline

```ts
// Server-Sent Events from @fonderie/sse — one shared connection per client.
const stop = client.sse.subscribe(['fonderie.customer.*'], (e) => refetch(e.data.customerId), {
  onReset: refetchAll, // (re)connected: events may have been missed
});
```

Remote config is read through `@fonderie/react` / `@fonderie/vue`
(`useRemoteConfig(key, fallback)`, `withRemoteConfig`), which keep it live over
the same stream. Give the client a `storage` so a cold start with no signal
decides from the last answer, and hold the first render on `config.ready`:

```ts
const client = new FonderieClient({
  baseUrl,
  config: { storage: AsyncStorage },   // or window.localStorage
  log: { warn: (m) => logger.warn(m) }, // default: console
});
await client.config.ready; // e.g. in PersistGate onBeforeLift, or before hiding the splash
```

`client.sse.status` is `'unavailable'` when the runtime cannot stream (React
Native's default fetch — pass Expo's as `new FonderieClient({ sse: { fetch } })`)
or the server has no `@fonderie/sse`; nothing breaks — values stay as last known and refresh on the next start. Call
`client.sse.pause()` / `resume()` when the app leaves and returns to the
foreground.

A serverless API cannot hold streams: serve them from a long-running host and
point the client there with `new FonderieClient({ baseUrl, sse: { baseUrl: 'https://stream.example.com' } })`
— only `/sse/stream` goes to it.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the consumer side. Typed access to any Fonderie-powered API from
browser, Node, or edge — with request/response shapes that stay in lockstep
with the server because both live in this monorepo.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
