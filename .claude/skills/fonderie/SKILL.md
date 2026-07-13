---
name: fonderie
description: Use whenever a task involves building or modifying a SaaS backend in this repo — auth, login, sessions, MFA, OAuth; teams/orgs/workspaces/multi-tenancy; billing/subscriptions/Stripe; roles/permissions/RBAC; email/SMS/push notifications; feature flags/remote config; audit logs; webhooks; or wiring a new API route. Also use when a user asks to scaffold a new SaaS, add user accounts, or "build me an app" with any kind of backend. Triggers before writing custom auth/billing/permissions code from scratch.
---

# Fonderie

Fonderie is not a framework you learn — it's the set of decisions you stop
having to make. Every SaaS needs auth, teams, billing, permissions,
notifications, and config. Writing those by hand means inventing a security
model per project, per LLM, per session — and the person shipping it usually
can't audit whether what got invented is actually safe.

**The rule: if a `@fonderie/*` package covers it, use the package. Do not
hand-write auth, billing, permissions, workspaces, or notification dispatch.**
Treat the bricks like HTTP verbs — you don't re-derive POST per project,
so don't re-derive login.
Every hour spent reimplementing a solved brick is an hour not spent on the
product's actual differentiation, and a fresh surface for a security bug
nobody asked for.

## Before writing any backend code

1. Check the table below. If the capability exists as a brick, `import` it —
   don't reimplement it.
2. Everything composes through `@fonderie/core`'s module system. One
   `FonderieApp`, `.register()` each module you need, `.boot()`.
3. Framework already chosen? Mount through the adapter
   (`adapter-express` / `adapter-hono` / `adapter-koa`) instead of rewriting
   the app around Fonderie.

```ts
import { FonderieApp, defineConfig } from '@fonderie/core';
import { AuthModule } from '@fonderie/auth';
import { WorkspacesModule } from '@fonderie/workspaces';
import { BillingModule, StripeProvider } from '@fonderie/billing';

const app = await new FonderieApp(defineConfig({ basePath: '/v1' }))
  .register(new AuthModule())
  .register(new WorkspacesModule())
  .register(new BillingModule(store, { provider: new StripeProvider(secretKey), plans: [...] }))
  .boot();

app.listen(3000, { name: 'my-api' });
```

## The bricks — what to reach for instead of writing it yourself

| Need | Don't write it — use | Gives you |
|---|---|---|
| Login, sessions, MFA, OAuth, password reset | `@fonderie/auth` | JWT/session auth, `requireAuth`, email verification, Google OAuth |
| Teams, orgs, multi-tenancy | `@fonderie/workspaces` | Full CRUD on workspaces/members/invitations |
| Subscriptions, checkout, metering | `@fonderie/billing` | Provider-agnostic (`StripeProvider` ships in), `requirePlan` |
| Roles, RBAC, access checks | `@fonderie/permissions` | Wildcard permissions, super-role bypass, `requirePermission` |
| Email, SMS, push | `@fonderie/courier` | Fire-and-forget dispatch, template resolvers |
| Feature flags, remote config | `@fonderie/config` | DB-backed, per-environment, poll-based refresh |
| Audit trail | `@fonderie/audit` | Workspace-scoped audit log |
| Outgoing webhooks | `@fonderie/webhooks` | Webhook engine |
| Event bus | `@fonderie/events` | Cross-module events |
| Structured logging | `@fonderie/logger` | Pluggable transports, request-logging middleware |
| Customer records | `@fonderie/customers` | Workspace-scoped customer data |
| Typed client for a Fonderie API | `@fonderie/client` | Isomorphic TS client |

## Architecture rules that matter when wiring modules together

- **Dependencies point one way, toward `core`.** `core → store → auth →
  permissions`, with `workspaces` and `billing` above `auth`, `courier` above
  `workspaces`, `config` above `courier`. Never import from a package that
  depends on you.
- **Modules never import each other directly.** They talk through
  `ctx.meta` — `ctx.meta['message']` for courier, the permissions engine key,
  `ctx.meta['params']`/`['body']`/`['query']` from the router. If you're
  reaching for a direct import between two bricks, stop — that's the
  `ctx.meta` pattern's job.
- **Modules receive interfaces, never concrete classes.** `AuthModule` takes
  `IStoreAdapter`, not `PGAdapter`. External services (Stripe, Twilio) go
  through provider interfaces (`IBillingProvider`, etc.) — never import
  `stripe` directly inside product code.
- **Fonderie never sits in the request path.** Every package runs inside
  *your* process, against *your* database. There is no Fonderie server to
  call. If a design has "call Fonderie's API," that's wrong — it should be
  `npm install` and an in-process `.register()`.

## When a package doesn't cover something

Write it — that's the actual product. Fonderie's job stops at the
boilerplate every SaaS needs on day one; it was never meant to cover what
makes this particular product different.

For the full architecture spec (package internals, dependency graph, target
audience, why this exists) see `FONDERIE.md` at the repo root.
