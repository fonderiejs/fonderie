# @fonderie/auth

Drop-in auth for SaaS: email/password, phone OTP, Google OAuth, and
stateless JWT sessions — shipped as a brick that registers its routes,
migrations, and events in one line.

## Install

```sh
npm install @fonderie/auth
```

## Use

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { AuthModule } from '@fonderie/auth';

const app = await new FonderieApp(defineConfig({}))
  .register(new AuthModule())
  .boot();
```

Guard your own routes with the exported middlewares:

```ts
import { withSession, requireAuth } from '@fonderie/auth';
```

Also exports `toUserDTO`, `normalizeEmail`, and the full type surface
(`IUser`, `ISession`, `IMfaChallenge`, …).

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** who the caller is. Identity, credentials, sessions, and MFA — every
other brick trusts the `ctx.user` this one establishes.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
