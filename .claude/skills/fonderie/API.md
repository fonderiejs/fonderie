# Fonderie API reference

How the bricks compose: rules, routes, and a verified wiring example. For
the exact, machine-generated signature of every export, see
the per-package file `signatures/<package>.md` (indexed in
[SIGNATURES.md](SIGNATURES.md), regenerated via `npm run docs:signatures`) —
open only the one you need.
Between the two files there is never a reason to read package source out of
`node_modules`.

## Golden wiring example — auth + password-reset email

Copy this shape; swap modules in and out. This exact composition is verified
against the shipped packages.

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { AuthModule, MESSAGE_KEYS } from '@fonderie/auth';
import { getMigrationsPath as authMigrations } from '@fonderie/auth/migrations';
import { CourierModule, type ICourierConfig } from '@fonderie/courier';
import { getMigrationsPath as courierMigrations } from '@fonderie/courier/migrations';
import { EventsModule, MemoryTransport } from '@fonderie/events';
import { InternalMigrationRunner, PGAdapter } from '@fonderie/store';

export async function buildFonderie() {
  const store = new PGAdapter(process.env.DATABASE_URL!);
  if (!(await store.testConnection())) throw new Error('check DATABASE_URL');

  // Run each registered module's migrations before boot.
  await new InternalMigrationRunner(store, authMigrations()).run();
  await new InternalMigrationRunner(store, courierMigrations()).run();

  // In-process bus: auth emits notification events, courier delivers them.
  const events = new EventsModule({ transport: new MemoryTransport() });

  const courierConfig: ICourierConfig = {
    channels: { [MESSAGE_KEYS.passwordReset]: ['email'] },
    templates: { source: 'fs', directory: './templates/email' },
    email: {
      provider: 'smtp',
      from: 'no-reply@example.com',
      smtp: {
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    },
  };

  const fonderie = await new FonderieApp(defineConfig({ db: { url: process.env.DATABASE_URL! } }))
    .register(events)
    .register(new AuthModule(store, {
      providers: ['email'],
      appName: 'my-app',
      jwtSecret: process.env.JWT_SECRET!,
      sessionDuration: '7d',
    }, events.bus))
    .register(new CourierModule(courierConfig, store, events.bus))
    .boot();

  // Return the store too — adapter guards like withWorkspace(store) need it.
  return { fonderie, store };
}
```

Composition rules: register `EventsModule` first so `events.bus` exists for
the modules that emit; every `@fonderie/*/migrations` subpath exports
`getMigrationsPath(): string` for `InternalMigrationRunner`; sessions are
**stateless JWT** (access + refresh), not server-side session rows.

## @fonderie/core

- `new FonderieApp(config: FonderieConfig)` — methods: `.register(module)`,
  `.use(middleware)`, `.addRoute(method, path, ...handlers)`,
  `.boot(): Promise<this>`, `.handle(req: Request): Promise<Response>`,
  `.buildContext(req: Request)`, `.listen(port, { name?, version?, env? })`
- `defineConfig({ basePath?, db: { url } })` — `basePath` prefixes all routes
- `OPERATIONS` (`CREATE/READ/UPDATE/DELETE`), `Operation` type
- Middlewares from `@fonderie/core/middlewares`: `withCors`, `requireAuth`, request logging, body parsing
- Helpers: `HTTP`, `setApiResponse`, `compose`, defensive parsers
  (`stringOrEmpty`, `numberOrZero`, `booleanOrFalse`, `arrayOrEmpty`, `dateOrEmpty`)
- `ctx.meta` well-known keys: `params`, `body`, `query`, `workspaceId`, `userId`, `message`

## @fonderie/store

- `new PGAdapter(connectionUrl: string)` — implements `IStoreAdapter`;
  `.testConnection(): Promise<boolean>`
- `new InternalMigrationRunner(store, migrationsPath).run()`
- `` sql`...` `` tagged template → `ISqlQuery`

## @fonderie/rate-limit

- `new StoreAdapterStore(store)` / `new MemoryStore()` / `new RedisStore(client)`
- `rateLimit(...limits)` → Middleware; each limit is `{ store, rule, key }`
  where `rule` is `{ capacity, refillPerSec, cost? }` and `key` is
  `byIp(scope)` or `byBodyField(scope, field)`
- Emits `RateLimit-*` + `Retry-After` headers on 429 `RATE_LIMITED`.
  Distributed-correct: token bucket applied atomically per store.
- **@fonderie/auth wires this by default** on login/register/forgot/mfa —
  do NOT add express-rate-limit or a hand-rolled limiter to auth routes.
  Configure via the auth `rateLimit` option; disable with `rateLimit: false`.

## @fonderie/auth

- `new AuthModule(store: IStoreAdapter, config: IAuthConfig, bus?: EventBus)`

| `IAuthConfig` | Type | Notes |
|---|---|---|
| `providers` | `('email'\|'phone'\|'google'\|'github')[]` | required |
| `jwtSecret` | `string` | required |
| `appName?` | `string` | email copy + TOTP issuer |
| `sessionDuration?` | `string` | default `'7d'` |
| `mfa?` / `requireVerification?` | `boolean` | TOTP MFA; block unverified logins |
| `google?` | `{ clientId, clientSecret, redirectUri }` | for the google provider |

- Brute-force protection: login, register, forgot-password, and mfa/verify
  are rate-limited by default via @fonderie/rate-limit, backed by the
  module's own store (distributed across instances, zero config). Tune or
  disable with the `rateLimit` config field — do not add your own limiter.
- Request validation: every body-taking route is guarded by `validate(schema)`
  (zod). Invalid input → 422 `INVALID_PARAMETER` before the controller runs;
  parsed bodies are trimmed and stripped of unknown keys. Schemas are exported
  as `schemas.*` (`registerSchema`, `loginSchema`, `resetPasswordSchema`, …)
  — reuse them client-side instead of re-describing shapes.
- Exports: `requireAuth`, `withSession(store, config)`, `validate`, `schemas`, `MESSAGE_KEYS`
  (`passwordReset`, `emailRegistration`, `emailVerification`, `phoneOtp`, …),
  `EVENT_KEYS`, `toUserDTO`, `normalizeEmail`
- Routes registered: `POST /auth/register`, `POST /auth/login`,
  `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/email/forgot`,
  `POST /auth/email/reset`, `POST /auth/verify`, `GET /auth/send-verification`,
  `POST /auth/mfa/{setup,verify,disable}`, `GET /auth/google{,/callback}`,
  `GET /users`, `PUT /users/{profile,preferences,email,phone,password}`,
  `DELETE /users`
- Password reset flow = `POST /auth/email/forgot` (emits `passwordReset`
  message via the bus → courier) then `POST /auth/email/reset` with
  `{ email, pin, password }` — the pin is emailed and stored (single-use,
  expiring) in `fonderie_password_resets`.
- **Session semantics:** access tokens are session-bound JWTs — each pair
  carries a `sid` bound to its server-side session row, and `withSession`
  rejects an access token whose session is gone. Logout (body takes
  `{ refreshToken }`), token rotation, and password change therefore kill
  the access token immediately, not just the refresh token.
  `accessTokenDuration?` (default `'24h'`) bounds the stolen-token window.

## @fonderie/courier

- `new CourierModule(config: ICourierConfig, store?: IStoreAdapter, bus?: EventBus)`

| `ICourierConfig` | Type | Notes |
|---|---|---|
| `channels` | `Record<string, ('email'\|'sms'\|'push')[]>` | key = message key, e.g. `MESSAGE_KEYS.passwordReset` |
| `templates?` | `{ source: 'db'\|'fs', directory? }` | `'fs'` needs `directory` |
| `email?` | `IEmailChannelConfig` | `{ provider: 'smtp', from, smtp: { host, port, secure, user, pass } }` and others |
| `sms?` / `push?` | channel configs | optional |

## @fonderie/events

- `new EventsModule({ transport: MemoryTransport | PGTransport | { type: 'pg', connectionUrl, … } })`
- `.bus` (an `EventBus`) is what you hand to the other modules

## @fonderie/workspaces

- `new WorkspacesModule(store, config?: IWorkspacesConfig, bus?: EventBus)`
- Config: `invitationTtl?` (default `'7d'`),
  `personalWorkspace?` (auto-create on `user.registered`; needs bus; default `true`)
- Exports: `withWorkspace(store)`, `requireWorkspace`
- Routes: full CRUD under `/workspaces` — members, invitations
  (`POST /workspaces/invitations/accept`), roles + permissions, settings,
  archive/restore
- **Behavioral contracts** (things you'd otherwise discover by debugging):
  - Workspace context comes from the `x-workspace-id` request header
    (resolved by `withWorkspace`), not from the URL path.
  - The migration seeds two global system roles, `ADMIN` and `GUEST`
    (`workspace_id IS NULL`). Workspace creators get `ADMIN`; an invitation
    sent without `roleId` defaults to the system **GUEST** role (≥ 1.1.1 —
    least privilege). Pass a `roleId` from `GET /workspaces/roles` to grant
    anything more.
  - Accepting an invitation requires **both** `token` and `pin` (emailed;
    both also live in `fonderie_workspace_invitations` — see
    `signatures/workspaces-outcomes.md`). Invitations are single-use and
    expire after `invitationTtl`.
  - Personal workspaces (auto-created per user) don't accept invitations —
    inviting into one returns 403.

## @fonderie/billing

- `new BillingModule(store, config: IBillingConfig)`
- Config: `provider: new StripeProvider(secretKey)`, `plans: IBillingPlan[]`,
  `successUrl`, `cancelUrl`, `webhookSecret?`
- Exports: `requirePlan`, `requireFeature`, `hasFeature`, `getPlanLimit`, `withBilling`
- Routes: `GET/POST/PUT/DELETE /plans*`, `GET /billing/subscription`,
  `POST /billing/{checkout,portal,usage,webhook}`

## @fonderie/permissions

- `new PermissionsModule(store, config?: IPermissionsConfig)`
- Exports: `requirePermission(operation, permissionKey)`, `requireRole`,
  `PermissionsEngine`, `PermissionDeniedError`, `OPERATIONS`

## Other bricks (one-liners)

- `new ConfigModule(store, config?)` — feature flags; `getConfig(ctx)`
- `new AuditModule(store)` — workspace-scoped log at `GET /audit`
- `new WebhooksModule(store, config?, bus?)` — outgoing webhooks; CRUD at `/webhooks*`
- `new CustomersModule(store, config?, bus?)` — customer records at `/customers*`

## Request validation (all packages)

Every body-taking route across auth, workspaces, billing, customers, and
webhooks is guarded by `validate(schema)` from `@fonderie/core/middlewares`:
invalid input → 422 `INVALID_PARAMETER` (with field path) before the
controller runs; parsed bodies are trimmed and stripped of unknown keys.
Each package exports its schemas as `schemas.*` — reuse them client-side
instead of re-describing shapes. Two deliberate exceptions: courier's
`/courier/delivery/*` and billing's `/billing/webhook` receive
provider-shaped payloads and are gated by signature verification instead.

## Mounting inside an existing framework

Each adapter exports the same surface: `mount`, `bridge`, `adapt`, `cors`,
`requireAuth`, `withWorkspace(store)`, `requirePermission(op, key)`,
`requireFeature(key)`, `OPERATIONS`. The three guards lazy-load their optional
peer — install `@fonderie/workspaces` / `permissions` / `billing` only if you
use the matching guard.

```ts
// Express — infra routes are sealed lazily at app.listen()
import { mount } from '@fonderie/adapter-express';
const app = express();
app.use(express.json());
mount(app, fonderie, (app) => { app.use('/auth/login', loginLimiter); });
app.listen(3000);

// Hono — fonderie runs as the notFound fallback; call bridge() before your routes
import { mount, bridge } from '@fonderie/adapter-hono';
hono.use('*', bridge(fonderie));
mount(hono, fonderie);

// Koa — needs koa-bodyparser first so rawBody is populated
import { mount } from '@fonderie/adapter-koa';
app.use(bodyParser());
mount(app, fonderie);
app.listen(3000);
```

### CORS — required for any browser frontend on another origin

`@fonderie/client` sends `X-Request-ID`, `traceparent` and `X-Workspace-ID`,
and always fetches with `credentials: 'include'`. A preflight rejects the
**whole** request when one of those headers is missing from the allow-list —
every call fails with "Failed to fetch" while curl keeps working (CORS is
browser-only). So never hand-roll the header list: both entry points below
ship it and stay in lockstep with the client.

```ts
// App level (covers EVERY route — custom routes, /health, webhooks)
import { cors } from '@fonderie/adapter-express'; // or -hono / -koa
app.use(cors({ credentials: true, origin: process.env.FRONTEND_URL! }));

// Pipeline level (fonderie routes only)
import { withCors, DEFAULT_CORS_HEADERS } from '@fonderie/core/middlewares';
fonderie.use(withCors({ credentials: true, origin: FRONTEND_URL }));
```

Options: `origin` — a string, a **list** (apex and `www` are two different
origins), or a predicate for patterns like preview deploys (`() => true`
reflects any). String forms are normalized: a trailing slash, stray whitespace
or odd casing can't silently break every request, since an `Origin` header
never carries a path or trailing slash to begin with. Also `credentials`,
`headers` (extend, don't replace:
`[...DEFAULT_CORS_HEADERS, 'X-My-Header']`), `exposeHeaders` (defaults to
`X-Request-ID` so the client can read the echoed id on
`FonderieApiError.requestId`), `methods`. `credentials: true` with the
default `origin: '*'` throws at boot — browsers reject that pair.

## Shipping it — the file layout deployment depends on

Structure the app this way from the start. It costs nothing locally and is the
difference between deploying and debugging a crash loop. The three example apps
and `templates/starter` all ship it; the full guide is
[`examples/DEPLOYMENT.md`](../../../examples/DEPLOYMENT.md).

| File | Role | Serverless |
|---|---|---|
| `fonderie.ts` | store + modules + `await fonderie.boot()` | imported |
| `app.ts` | builds the framework app, **`export default`**s it, **no `listen`** | ✅ entrypoint |
| `index.ts` | the long-running server (`listen`) + anything needing process lifetime | ❌ never runs |
| `migrate.ts` | standalone migration runner | ❌ out of band |

Vercel's Node web-server builder searches `app.*` → `index.*` → `server.*` and
serves the **default export**, so `app.ts` wins and just works — no functions
directory, no `vercel.json`, no wrapper. Two ways to break it: put a `listen`
in `app.ts`, or leave the default export off (→ *"The default export must be a
function or server"*). The entrypoint must import the framework directly
(`import express from 'express'`) — that's the detection signal. Koa exports
`app.callback()`, since a Koa app isn't a request listener by itself.

**Never run migrations at boot.** Every cold start would re-run them on the
request path and concurrent instances would race. That is what `migrate.ts` is
for: `DATABASE_URL='<direct-connection>' npm run migrate`, once per deploy.

**Serverless can't do three things** — design around them rather than
discovering them in production:

- *Background timers* — an instance is frozen between requests, so
  `setInterval` never reliably fires. Keep timers in `index.ts` and drive the
  same work with a scheduled ping to a secret-guarded route.
- *Detached promises* — the SAME freeze abandons any work left running after
  the response. The robust answer is the durable outbox: give `EventsModule`
  the Postgres transport so a producer writes a row inside the request, and
  consume it either with `bus.start()` on a long-running host or `bus.drain()`
  from a scheduled ping where nothing long-running exists. That path survives a
  crash and retries; awaiting does neither. Fonderie routes its own dispatch (emails, webhooks, events)
  through `background()`, which waits on serverless and detaches elsewhere;
  override with `FONDERIE_BACKGROUND_TASKS=auto|await|detach`. If YOUR code
  detaches work, wrap it the same way or it will be dropped in production
  with no error anywhere. Better than either mode where the platform offers
  it: `setBackgroundRunner((w) => waitUntil(w))` keeps the instance alive
  *after* the response, so the work finishes without costing the caller
  latency.

  Two things about the outbox that are not obvious until they bite:

  **Register the consuming modules on the PRODUCER too.** `publish()` writes
  one event row plus one row per consumer *that the publishing process has
  subscribed*. An API that publishes without registering courier writes events
  owed to nobody — the worker polls, finds no rows, and the mail is
  undeliverable forever, not queued. Build the module list in one shared
  function both processes call, so they cannot drift.

  **Pick the consumer explicitly per deployment.** `bus.start()` where a
  process outlives the request; `bus.drain()` where none does — from a
  scheduled ping, or after each response via `background()` when the app is its
  own consumer. Draining concurrently is safe (claims are exclusive and stale
  ones are reclaimed on a timeout), so the failure mode to design against is
  *nobody* draining, not two. Watch `deadLetters()`/`pendingCount()` from a
  health or cron route: a queue that has silently stopped delivering looks
  exactly like one with nothing to do.

  **The queue does not tell you whether email was sent.** Courier catches a
  send failure, records it, and deliberately does not rethrow — a bad address
  must not poison the event — so the handler resolves and the consumer row is
  marked `processed` whether the message went out or not. An SMTP rejection is
  therefore indistinguishable from a clean send in `fonderie_event_consumers`,
  and `deadLetters()` stays empty no matter how badly email is failing. Read
  `fonderie_message_log` (`status` sent/failed/pending, plus the provider
  error) for that question; the queue only answers whether the event was
  dispatched. And `sent` still means the provider ACCEPTED it — an async bounce
  looks like success from here.
- *In-memory state* — rate-limit buckets, caches and sessions reset per
  instance. Use the store-backed equivalents (e.g. `StoreAdapterStore` for
  `@fonderie/rate-limit`), or the limit silently stops limiting.
- *Long-running or heavyweight work* — queue consumers, browser automation,
  anything past the function timeout. Run those as separate processes against
  the same database.

**Connections:** point `DATABASE_URL` at a hosted Postgres (a localhost or
SSH-tunnelled one is unreachable). Behind a transaction-mode pooler, cap the
pool at 1 per instance — pg defaults to 10 and every warm instance holds its
own. Use the direct connection for migrations, and for anything that needs
`LISTEN` (the `@fonderie/events` PG transport), which transaction pooling does
not support.

**Production guards fail the boot, deliberately and one at a time** — set these
before the first deploy: a real `JWT_SECRET` (auth rejects placeholder/dev
values), a unique 32+ char `RISK_PEPPER` if `@fonderie/risk` is registered, and
`SMTP_HOST` if any module sends mail.
