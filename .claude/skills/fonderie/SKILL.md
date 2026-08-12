---
name: fonderie
description: Use whenever a task involves building or modifying a SaaS backend in this repo — auth, login, sessions, MFA, OAuth; teams/orgs/workspaces/multi-tenancy; billing/subscriptions/Stripe; roles/permissions/RBAC; email/SMS/push notifications; feature flags/remote config; audit logs; webhooks; or wiring a new API route. Also covers frontend auth, billing, workspaces, and audit-log viewing for React, React Native, and Vue — login/register/session hooks, pricing/checkout/subscription hooks, team/member/invite hooks, audit-log hooks with cursor pagination, and pre-built screens for all four — plus admin-token-authenticated dashboards (React and Vue) for courier's email/SMS/push templates and for config's feature flags/remote config/secrets. Also use when a user asks to scaffold a new SaaS, add user accounts, add a login screen, add a pricing page, add a team/members page, add an audit/activity log page, add an admin panel for email templates or feature flags/secrets, or "build me an app" with any kind of backend or frontend. Triggers before writing custom auth/billing/permissions/workspaces/audit/courier/config code, a hand-rolled login form, pricing table, team switcher, audit log viewer, template editor, or config/secrets dashboard, from scratch.
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
4. **Read [API.md](API.md) before wiring anything.** It has the composition
   rules, registered routes, and a complete copy-paste `buildFonderie()`
   example — usually enough on its own. For an exact signature or config
   shape beyond that, open **only the per-package file** for the brick you
   are wiring: `signatures/<package>.md` (e.g. `signatures/auth.md`) — listed
   in [SIGNATURES.md](SIGNATURES.md). Load only what you need; do not read all
   of them, and do not read package source out of `node_modules`.
5. **Need to know what a package DID to the app — tables, seeded rows,
   routes?** Read `signatures/<package>-outcomes.md`
   (e.g. `signatures/auth-outcomes.md`): every DB table the package's
   migrations create (with columns), every seeded row, and every HTTP route
   it registers with its middleware chain. That answers "what do I query /
   what do I call / what already exists" without touching `dist/`. If you
   genuinely need the raw migration SQL, it ships at
   `node_modules/@fonderie/<pkg>/dist/migrations/sql/` — read it in place;
   never `npm pack` or download tarballs to inspect a package.
6. **Local email:** modules send through SMTP config. In development point
   `SMTP_HOST`/`SMTP_PORT` at a dev sink (e.g. `npx maildev`, SMTP on 1025)
   instead of improvising one; invitation and password-reset tokens are also
   readable from their tables (see the outcomes files) when a flow needs them
   programmatically.

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
| Roles, RBAC, access checks | `@fonderie/permissions` | Wildcard permissions, super-role bypass, `requirePermission` (server-side only — no HTTP API; role CRUD for a frontend is under `@fonderie/workspaces`, see `react-workspaces`'s `useRoles`/`useMemberRoles` below) |
| Email, SMS, push | `@fonderie/courier` | Fire-and-forget dispatch, template resolvers |
| Feature flags, remote config | `@fonderie/config` | DB-backed, per-environment, poll-based refresh |
| Audit trail | `@fonderie/audit` | Workspace-scoped audit log |
| Outgoing webhooks | `@fonderie/webhooks` | Webhook engine |
| Event bus | `@fonderie/events` | Cross-module events |
| Structured logging | `@fonderie/logger` | Pluggable transports, request-logging middleware |
| Customer records | `@fonderie/customers` | Workspace-scoped customer data |
| Typed client for a Fonderie API | `@fonderie/client` | Isomorphic TS client |

## Frontend — auth hooks and pre-built screens

Same rule applies: if the app has a frontend, wire auth through these
instead of hand-rolling a login form and its own token-storage logic. All
three wrap `@fonderie/client`'s `AuthClient` — construct one `FonderieClient`
at the app root and pass `client.auth` into the hook/composable (React
context, Vue provide/inject, or a prop). Token persistence (`localStorage` /
`AsyncStorage`) and error handling (`FonderieApiError`) are already handled
inside the hook — don't re-implement either in app code.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React auth hooks | `@fonderie/react-auth` | `useLogin`, `useRegister`, `useSession`, `useLogout`, `useForgotPassword`, `useResetPassword`, `useVerifyEmail` |
| React pre-built auth screens | `@fonderie/react-auth-screens` | `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen` built on the hooks above |
| React Native auth hooks | `@fonderie/react-native-auth` | Same hooks as `react-auth`, token persisted to `AsyncStorage` |
| React Native pre-built auth screens | `@fonderie/react-native-auth-screens` | Same three screens, React Native components |
| Vue 3 auth composables | `@fonderie/vue-auth` | Same shape as the React hooks, as Vue composables |
| Vue 3 pre-built auth screens | `@fonderie/vue-auth-screens` | Same three screens, as Vue components |

Billing follows the same pattern (`client.billing` instead of `client.auth`).
`client.auth` and `client.billing` share one token internally — signing in
via an auth hook authenticates billing requests too, nothing extra to wire.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React billing hooks | `@fonderie/react-billing` | `usePlans`, `usePlan`, `useSubscription`, `useCheckout`, `useBillingPortal`, `useUsage`, `useRecordUsage` |
| React pre-built billing screens | `@fonderie/react-billing-screens` | `PricingScreen`, `SubscriptionScreen` built on the hooks above |
| React Native billing hooks | `@fonderie/react-native-billing` | Re-exports `react-billing` as-is — billing has no platform-specific storage, unlike auth |
| React Native pre-built billing screens | `@fonderie/react-native-billing-screens` | Same two screens, React Native components |
| Vue 3 billing composables | `@fonderie/vue-billing` | Same shape as the React hooks, as Vue composables |
| Vue 3 pre-built billing screens | `@fonderie/vue-billing-screens` | Same two screens, as Vue components |

Workspaces follows the same pattern (`client.workspaces`). Requests default
to the caller's personal workspace until you call
`client.workspaces.setWorkspaceId(id)` to scope them to a team — same
header, same fallback behavior billing's `setWorkspaceId` uses.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React workspaces hooks | `@fonderie/react-workspaces` | `useWorkspaces`, `useCreateWorkspace`, `useMembers`, `useRemoveMember`, `useInvitations`, `useAcceptInvitation`, `useWorkspaceSettings`, plus role management — `useRoles`, `useUpdateRole`, `useSetRolePermissions`, `useMemberRoles` (`@fonderie/permissions` has no HTTP API; role CRUD lives here) |
| React pre-built workspaces screens | `@fonderie/react-workspaces-screens` | `TeamMembersScreen`, `InviteMembersScreen` built on the hooks above |
| React Native workspaces hooks | `@fonderie/react-native-workspaces` | Re-exports `react-workspaces` as-is — no platform-specific storage, unlike auth |
| React Native pre-built workspaces screens | `@fonderie/react-native-workspaces-screens` | Same two screens, React Native components |
| Vue 3 workspaces composables | `@fonderie/vue-workspaces` | Same shape as the React hooks, as Vue composables |
| Vue 3 pre-built workspaces screens | `@fonderie/vue-workspaces-screens` | Same two screens, as Vue components |

Audit follows the same session-authenticated pattern (`client.audit`,
shared token, `setWorkspaceId`) — but it's read-only: `@fonderie/audit` has
one route, so there's one hook per framework, not seven.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React audit-log hook | `@fonderie/react-audit` | `useAuditEvents` — cursor-paginated, filterable by type/actorId/date range, `loadMore` |
| React pre-built audit-log screen | `@fonderie/react-audit-screens` | `AuditLogScreen` (filters + expandable JSON payload + load-more) built on the hook above |
| React Native audit-log hook | `@fonderie/react-native-audit` | Re-exports `react-audit` as-is — no platform-specific storage, unlike auth |
| React Native pre-built audit-log screen | `@fonderie/react-native-audit-screens` | Same screen, React Native components |
| Vue 3 audit-log composable | `@fonderie/vue-audit` | Same shape as the React hook, as a Vue composable |
| Vue 3 pre-built audit-log screen | `@fonderie/vue-audit-screens` | Same screen, as Vue components |

Courier's frontend surface is different in kind: `@fonderie/courier` has no
user-facing HTTP API (messages are sent server-side via the event bus), only
an admin-token-guarded template-editing one (`/admin/templates/*`). Its
client (`CourierAdminClient`) is **not** a `FonderieClient` sub-client — it
takes its own `{ baseUrl, adminToken }` and shares no state with
`client.auth`/`client.billing`/`client.workspaces`. No React Native package:
a template editor with a code/HTML textarea and revision history is an
admin-dashboard surface, not a phone screen.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React courier template-admin hooks | `@fonderie/react-courier-admin` | `useTemplates`, `useTemplate`, `useSaveTemplate`, `useDeleteTemplate`, `useTemplateRevisions` (list + rollback) |
| React pre-built template-admin screens | `@fonderie/react-courier-admin-screens` | `TemplateListScreen`, `TemplateEditorScreen` (edit form + revision history + rollback) |
| Vue 3 courier template-admin composables | `@fonderie/vue-courier-admin` | Same shape as the React hooks, as Vue composables |
| Vue 3 pre-built template-admin screens | `@fonderie/vue-courier-admin-screens` | Same two screens, as Vue components |

Config's admin surface follows the same pattern as courier's — a standalone
`ConfigAdminClient` with its own `{ baseUrl, adminToken }`, not a
`FonderieClient` sub-client. It covers both of config's admin resources:
feature-flag/remote-config entries and secrets (masked by default; a
`reveal` action returns plaintext on demand). No React Native package, same
reasoning as courier-admin.

| Need | Don't write it — use | Gives you |
|---|---|---|
| React config/secrets admin hooks | `@fonderie/react-config-admin` | `useConfigEntries`, `useConfigEntry`, `useSaveConfigEntry`, `useDeleteConfigEntry`, `useConfigRevisions`, plus the secret equivalents and `useRevealSecret` |
| React pre-built config/secrets admin screens | `@fonderie/react-config-admin-screens` | `ConfigListScreen` (config + masked secrets dashboard), `ConfigEditorScreen` (JSON/secret editor + revision history + rollback) |
| Vue 3 config/secrets admin composables | `@fonderie/vue-config-admin` | Same shape as the React hooks, as Vue composables |
| Vue 3 pre-built config/secrets admin screens | `@fonderie/vue-config-admin-screens` | Same two screens, as Vue components |

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
