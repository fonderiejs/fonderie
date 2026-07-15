# @fonderie/rate-limit

Distributed rate limiting for `@fonderie-js` — an atomic token bucket over
in-memory, PostgreSQL, or Redis, emitting standard `RateLimit-*` headers.

## Install

```sh
npm install @fonderie/rate-limit
```

## Why it exists

`@fonderie/auth` wires this in front of login, registration, password reset,
and MFA verification **by default** — so an app that just said "add login"
gets brute-force protection without asking. Use it directly to guard your own
routes.

## Stores

All three implement one atomic operation (`consume`), so switching backends
never changes behavior — only where the counters live and how far they scale.

| Store | Use when | Atomicity |
| --- | --- | --- |
| `MemoryStore` | single instance, dev | single-threaded event loop |
| `StoreAdapterStore` | multiple instances on Postgres (default in auth) | one `INSERT … ON CONFLICT` upsert |
| `RedisStore` | millions of users / high write volume | one Lua `eval` |

`RedisStore` takes any client with an `eval()` method (ioredis, node-redis) —
this package depends on no Redis library. `StoreAdapterStore` ships a
`migrations/` subpath for its one table.

## Use

```ts
import { rateLimit, byIp, byBodyField, StoreAdapterStore } from '@fonderie/rate-limit';

const store = new StoreAdapterStore(myStoreAdapter);

// 10 requests / 15 min per IP AND 5 / 15 min per account — both must allow.
app.post('/auth/login', adapt(rateLimit(
	{ store, rule: { capacity: 10, refillPerSec: 10 / 900 }, key: byIp('login') },
	{ store, rule: { capacity: 5, refillPerSec: 5 / 900 }, key: byBodyField('login', 'email') },
)), loginHandler);
```

Denied requests get `429` with `RateLimit-Limit` / `RateLimit-Remaining` /
`RateLimit-Reset` and `Retry-After`. `byIp` reads `ctx.meta.clientIp`, which
the Fonderie adapters resolve with explicit proxy trust (`TRUST_PROXY`).

## License

MIT © Fonderie, Inc.
