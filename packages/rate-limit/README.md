# @fonderie/rate-limit

Distributed rate limiting for `@fonderie-js` — an atomic token bucket, backed
by your PostgreSQL by default, with an in-memory store for single instances
and a Redis store for very high volume. Emits standard `RateLimit-*` headers.

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

## Deploying behind a proxy (nginx, Kubernetes ingress, load balancer)

`byIp()` reads the client IP that the Fonderie adapter resolved into
`ctx.meta.clientIp`. **Read this if you run behind any L7 proxy — the default
is wrong for you, on purpose.**

The default (`TRUST_PROXY` unset) ignores `X-Forwarded-For` and uses the raw
socket address, which is spoof-safe but means: behind nginx or a Kubernetes
ingress, the socket address is the *proxy's* IP for every request. Every
client collapses onto one bucket, the per-IP limit becomes global, and a
single attacker can lock out your entire user base.

There is no default that is both spoof-safe and correct behind a proxy — they
contradict. So you must declare your topology:

```sh
# Number of trusted proxy hops between the internet and your app.
# One nginx / one ingress in front → 1.
TRUST_PROXY=1
```

With `TRUST_PROXY=N`, the client is taken as the Nth-from-the-right entry of
`X-Forwarded-For` — anything a client spoofs to the left of your trusted
proxies is ignored. Also ensure your proxy actually sets `X-Forwarded-For`
(nginx-ingress does by default), and for Kubernetes `LoadBalancer` services
consider `externalTrafficPolicy: Local` to preserve the source IP.

When it detects the mismatch — a forwarding header present but `TRUST_PROXY`
unset and the socket on a private/loopback address — the framework logs a
one-time warning at request time.

## Fail-open

`rateLimit()` **fails open by default**: if the store errors (database down,
Redis unreachable), the request is allowed through rather than rejected. This
is a deliberate availability-over-strictness choice — a limiter outage
shouldn't lock every user out of login. For endpoints where an unthrottled
request is worse than a rejected one, set `failClosed: true` per limit. Either
way, monitor your store: a silently failing limiter is a silently absent one.
