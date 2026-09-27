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
import { PGAdapter } from '@fonderie/store';
import { AuthModule } from '@fonderie/auth';

const store = new PGAdapter(process.env.DATABASE_URL!);

const app = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
  .register(new AuthModule(store, {
    providers: ['email'],
    appName: 'my-app',
    jwtSecret: process.env.JWT_SECRET!,
  }))
  .boot();
```

Guard your own routes with the exported middlewares:

```ts
import { withSession, requireAuth } from '@fonderie/auth';
```

Also exports `toUserDTO`, `normalizeEmail`, and the full type surface
(`IUser`, `ISession`, `IMfaChallenge`, …).

## Where did that request come from? (optional)

Pass a `location` resolver and auth stamps a location on every event it
records — each login attempt, each registration, and each new session:

```ts
import { geoFromHeaders } from '@fonderie/geo';

new AuthModule(store, {
  providers: ['email'],
  jwtSecret: process.env.JWT_SECRET!,
  // Vercel/Cloudflare edge headers — zero infrastructure. Trust comes from
  // the deployment, never the request.
  location: ({ headers }) =>
    geoFromHeaders(headers, { trust: process.env.VERCEL ? 'vercel' : undefined }),
});
```

Login history then includes `registration` rows alongside sign-ins, and both
history events and active sessions carry `location: { country, subdivision,
city, timeZone, … } | null` (plus `isp`/`asn`/`proxy`/`hosting` if your
resolver knows them). Registration matters most when verification is not
enforced: the account is live from that request, so it is the first record of
where the user came from.

Run your migrations: `018_login_event_location.sql` and
`019_session_location.sql` add the columns. The resolver runs at most once per
request; its output is sanitized and bounded (coordinates ~1 km); if it throws or takes over 1.5 s the row is written without a location
and the request is unaffected. Country is reliable; region and city are
approximate.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/fonderie/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** who the caller is. Identity, credentials, sessions, and MFA — every
other brick trusts the `ctx.user` this one establishes.

Browse the whole set at
[fonderiejs/fonderie](https://github.com/fonderiejs/fonderie) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
