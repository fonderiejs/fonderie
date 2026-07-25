# @fonderie/config

A Postgres-backed **control plane** for the settings and secrets your app changes
without a deploy — feature flags, remote config, and secrets — each **versioned,
with optimistic concurrency, revisions, rollback, and near-instant propagation**.
Manage it over an admin HTTP surface or the `fonderie` CLI.

## Install

```sh
npm install @fonderie/config
```

## Read config at runtime

Register the module and read live values through `ctx.meta` — a per-environment
snapshot (with `'all'` as the base, env-specific overrides on top) kept fresh by
a poll floor and, when a `connectionUrl` is given, **`LISTEN/NOTIFY` push** so a
change lands in milliseconds.

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { PGAdapter } from '@fonderie/store';
import { ConfigModule, getConfig } from '@fonderie/config';

const store = new PGAdapter(process.env.DATABASE_URL);
const app = await new FonderieApp(defineConfig({}))
  .register(new ConfigModule(store, {
    environment: 'production',
    connectionUrl: process.env.DATABASE_URL, // opt-in push invalidation
  }))
  .boot();

// in a handler:
const on = getConfig(ctx, 'feature.new-onboarding', false);
```

## Manage it (versioned + optimistic concurrency + rollback)

Every write bumps a monotonic `version`, appends an immutable revision, and
records the actor. Pass `ifVersion` for a compare-and-swap — the write commits
only if the version matches, else throws `ConfigConflictError` (reject-and-retry).
Writes are advisory-locked per `(key, environment)`, so concurrent creators of the
same key are serialized. `rollbackConfigEntry` rolls *forward* to a past value.

```ts
import {
  setConfigEntry, getConfigEntry, rollbackConfigEntry,
  listConfigRevisions, ConfigConflictError,
} from '@fonderie/config';

await setConfigEntry({ key: 'rate.limit', value: 100, ifVersion: 3, actor: 'ada' }, store);
const revs = await listConfigRevisions('rate.limit', 'all', store);
await rollbackConfigEntry({ key: 'rate.limit', toVersion: 2, actor: 'ada' }, store);
```

## Secrets (masked, encryptable)

Same lifecycle, a separate `fonderie_secrets` table + read path so config can
never leak a secret. `getSecret`/`listSecrets` return **metadata only** (never the
value); values are **encrypted at rest** via a pluggable encryptor; `revealSecret`
is the single decrypt path.

```ts
import { setSecret, revealSecret, createAesGcmEncryptor } from '@fonderie/config';

const enc = createAesGcmEncryptor(process.env.SECRET_KEY); // 32-byte hex, or omit for masked-only
await setSecret({ key: 'stripe.key', value: 'sk_live_…', actor: 'ada' }, store, enc);
const value = await revealSecret('stripe.key', 'all', store, enc);
```

## Admin HTTP surface

Set `adminToken` and the module registers `Bearer`-guarded routes (fail-closed —
no token, no surface): `GET/PUT/DELETE /admin/config[/:key]`,
`GET /admin/config/:key/revisions`, `POST /admin/config/:key/rollback`, and the
same for `/admin/secrets/*` (`PUT` honours `ifVersion` → **409** on conflict;
secret reads masked; `POST /admin/secrets/:key/reveal` decrypts).

```ts
new ConfigModule(store, { adminToken: process.env.ADMIN_TOKEN, secretEncryptor: enc });
```

## CLI

A thin client over that surface (`FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`):

```sh
fonderie config set feature.new-onboarding true --if-version 3
fonderie config history feature.new-onboarding
fonderie config rollback feature.new-onboarding --to-version 2
fonderie secret set stripe.key sk_live_… && fonderie secret reveal stripe.key
```

## Dependencies

Zero runtime dependencies. Peers only: `@fonderie/core`, `@fonderie/store`, and
`pg` (for the LISTEN client) — all already present in a Fonderie app.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging — and the
next project will ask for it again. Fonderie packages it once: plain TypeScript
modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no per-seat
anything. Register the modules you need; skip the ones you don't.

**This package owns** how behavior — and secrets — change without a deploy.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
