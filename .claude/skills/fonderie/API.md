# Fonderie API reference

How the bricks compose: rules, routes, and a verified wiring example. For
the exact, machine-generated signature of every export, see
[SIGNATURES.md](SIGNATURES.md) (regenerated via `npm run docs:signatures`).
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
- Middlewares from `@fonderie/core/middlewares`: `cors`, `requireAuth`, request logging, body parsing
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
  message via the bus → courier) then `POST /auth/email/reset`.

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
- Config: `invitationTtl?` (default `'7d'`), `defaultRole?` (`'member'`),
  `personalWorkspace?` (auto-create on `user.registered`; needs bus; default `true`)
- Exports: `withWorkspace(store)`, `requireWorkspace`
- Routes: full CRUD under `/workspaces` — members, invitations
  (`POST /workspaces/invitations/accept`), roles + permissions, settings,
  archive/restore

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

- `new RemoteConfigModule(store, options?)` — feature flags; `getConfig(ctx)`
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

Each adapter exports the same surface: `mount`, `bridge`, `adapt`,
`requireAuth`, `withWorkspace(store)`, `requirePermission(op, key)`,
`requireFeature(key)`, `OPERATIONS`. The last three lazy-load their optional
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
