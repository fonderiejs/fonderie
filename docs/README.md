# Fonderie handbook

The practical guide to working *on* Fonderie — how it's built, what each
piece does, and how to ship, teach, and measure it without breaking the
promises the project makes.

> Looking for the pitch or the thesis? That's [`../README.md`](../README.md)
> (what Fonderie is and why). This handbook is
> for the person maintaining the ecosystem.

## The map

| I want to… | Read |
| --- | --- |
| Get started as a user of the SDK | [GETTING-STARTED.md](GETTING-STARTED.md) |
| Understand the architecture and every component | This file |
| Know what each tool/script is for | [TOOLING.md](TOOLING.md) |
| Publish to npm and handle cross-package versions | [RELEASING.md](RELEASING.md) |
| Keep the LLM's knowledge of the SDK correct | [BRAIN.md](BRAIN.md) |

## Architecture in one picture

Fonderie is a monorepo of small TypeScript packages ("bricks"). Every
brick runs **in your process, against your database** — there is no
Fonderie server. An app composes the bricks it wants and boots them:

```
        ┌─────────────────────────────────────────────┐
        │              your application                │
        │  FonderieApp(config)                         │
        │    .register(AuthModule)                     │
        │    .register(WorkspacesModule)               │
        │    .register(BillingModule)                  │
        │    .boot()  ──►  one HTTP handler            │
        └───────────────────┬─────────────────────────┘
                            │  each module install(app)s
                            ▼
   bricks: auth · workspaces · billing · courier · permissions
           events · webhooks · audit · customers · rate-limit · config
                            │  every brick depends on…
                            ▼
             ┌───────────────────────────────┐
             │  @fonderie/core   (the engine) │  router, middleware
             │  @fonderie/store  (the ground) │  IStoreAdapter, PG, migrations
             └───────────────────────────────┘
```

Two rules explain the whole dependency graph:

1. **Everything peer-depends on `core` and `store`.** They are the only
   packages every brick needs, so they sit at the bottom and stay small.
2. **Bricks don't depend on each other in code.** When auth needs to send
   a verification email, it doesn't import courier — it writes a message
   onto the shared context (`ctx.meta`) or emits an event. Packages talk
   through contracts owned by `core`, never through direct imports. That's
   what lets a founder take one brick or the whole set.

## The module contract

Every brick implements the same tiny interface (in `@fonderie/core`):

```ts
interface IFonderieModule {
  name: string;                       // e.g. '@fonderie/auth'
  deps?: string[];                    // other modules that must boot first
  install(app: IFonderieApp): void | Promise<void>;  // register routes/middleware
  checkReadiness?(): IReadinessProblem[];             // opt-in prod-safety report
}
```

`FonderieApp.boot()` topologically sorts modules by `deps` and calls
`install` on each. `install` is where a brick adds its routes and
middleware. That's the entire extension model — no plugins framework, no
lifecycle hooks beyond boot and an optional readiness check.

## The components

### Foundations — pre-1.0, everything rests on them

| Package | Version | What it is |
| --- | --- | --- |
| `@fonderie/core` | 0.4.0 | Router, middleware pipeline, module system, shared context + response helpers. The engine. |
| `@fonderie/store` | 0.2.0 | `IStoreAdapter`, PostgreSQL driver, migration runner, SQL tagged-template helpers, and the versioned-resource control-plane primitive. |

These are intentionally still `0.x`: their public surface is the load-bearing
contract for everything else, and it was frozen-reviewed but not yet stamped
`1.0.0` (see [RELEASING.md](RELEASING.md) for why that matters to versioning).

### Bricks — the SaaS backend, one concern each

| Package | Version | What it gives you |
| --- | --- | --- |
| `@fonderie/auth` | 4.0.0 | Email/password, phone OTP, Google OAuth, stateless JWT sessions, TOTP MFA, password recovery. |
| `@fonderie/workspaces` | 4.0.0 | Multi-tenant teams: members, custom roles, token invitations, per-workspace route scoping. |
| `@fonderie/permissions` | 4.0.0 | RBAC — roles, per-resource CRUD, `requirePermission` route gate, multi-role via `BOOL_OR`. |
| `@fonderie/billing` | 4.0.0 | Config-driven plan catalogue, Stripe subscriptions, user + workspace billing, usage metering, webhooks. |
| `@fonderie/courier` | 4.0.0 | Multi-channel messaging (email/SMS/push), FS or DB templates, per-type routing, message log. |
| `@fonderie/config` | 4.0.0 | DB-backed feature flags + remote config, per-environment overrides, TTL hot reload, admin control plane. |
| `@fonderie/events` | 4.0.0 | Event bus with in-memory + PostgreSQL transports; adapter interface for Redis/Kafka/RabbitMQ. |
| `@fonderie/webhooks` | 4.0.0 | Outgoing webhook engine — register endpoints, fan out workspace events, track + retry delivery. |
| `@fonderie/audit` | 4.0.0 | Workspace-scoped activity trail over `fonderie_events`. |
| `@fonderie/customers` | 4.0.0 | Workspace-scoped customer records (people + businesses) with emails, phones, addresses, tags. |
| `@fonderie/rate-limit` | 3.0.0 | Atomic token-bucket limiter over memory/PostgreSQL/Redis, standard `RateLimit-*` headers. |

### Adapters — run bricks inside an existing app

| Package | Version | What it does |
| --- | --- | --- |
| `@fonderie/adapter-express` | 4.0.0 | `bridge()`, `adapt()`, `mount()` to use Fonderie middleware in native Express routes. |
| `@fonderie/adapter-hono` | 4.0.0 | Same, for Hono. |
| `@fonderie/adapter-koa` | 4.0.0 | Same, for Koa. |

### Client-facing tools

| Package | Version | Purpose |
| --- | --- | --- |
| `@fonderie/cli` | 0.3.0 | Teaches any coding agent the SDK without loading it eagerly; also drives a live deployment's admin API. See [TOOLING.md](TOOLING.md). |
| `@fonderie/client` | 0.1.1 | Isomorphic, fully-typed TS client for Fonderie APIs. Zero runtime deps. |
| `@fonderie/logger` | 0.1.1 | Structured logger, child loggers, request-logging middleware. |

## The self-hosted admin UI

Separate from the SDK, `organization/ui/` (in the parent repo) is a static,
zero-build admin dashboard a founder serves next to their deployment. It
talks to the Bearer-guarded admin routes (`/admin/config`, `/admin/secrets`,
`/admin/templates`) — the same routes the CLI drives. All the logic lives in
the SDK; the pages are thin, auditable HTML + vanilla JS clients. See the
Configuration, Secrets, and Templates consoles there.

## Where the numbers come from

Whenever this handbook cites a count — 19 packages, the version pins above,
"fewer tokens than scratch" — it's checkable in the repo: run
`node -e "..."` over the package manifests for versions.
Don't cite a number you can't point at.
