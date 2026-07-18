# The 10 canonical tasks + node/edge mapping (Phase 0 exit-gate deliverable)

For each task: which brain node/edge types must exist for `brain_query` to
answer it in ≤ 800 tokens. Fill the "grep-equivalent?" column honestly — if
grep over packages/* answers it as cheaply, the graph earns nothing there.
If that column is "yes" for most rows, the program stops (plan gate rule).

Packages referenced: auth, billing, workspaces, permissions, rate-limit,
courier, webhooks, config, audit, events, customers, store, core,
adapter-express/hono/koa.

| # | Canonical task | Required nodes | Required edges | Grep-equivalent? |
| --- | --- | --- | --- | --- |
| 1 | Add email/password auth with sessions | `@fonderie/auth` exports, session middleware, migrations | auth `requires` core, auth `configures` store, recipe:`basic-auth` | ☐ |
| 2 | Add OAuth (Google/GitHub) login | auth OAuth provider config keys | auth `configures` config, recipe:`oauth` | ☐ |
| 3 | Gate a route behind login | `requireSession` (middlewares) | adapter `imports` auth middleware | ☐ |
| 4 | Add teams/workspaces with invites | `@fonderie/workspaces` model + routes, courier invite email | workspaces `requires` auth, workspaces `emits-event` invite, courier `configures` | ☐ |
| 5 | Charge users / subscription plans | `@fonderie/billing` plans, Stripe config keys | billing `requires` customers, recipe:`stripe-checkout`, invariant: webhook route order | ☐ |
| 6 | Per-seat / team billing | billing plans × workspaces | billing `billed-by` workspaces, recipe:`per-seat-billing` | ☐ |
| 7 | Gate a feature by plan | plan-check helper / permissions grant | billing `secures` route, permissions `requires` billing | ☐ |
| 8 | Roles & permissions (admin/member) | `@fonderie/permissions` grants, RBAC model | permissions `requires` workspaces, recipe:`rbac` | ☐ |
| 9 | Send transactional email (welcome, reset) | `@fonderie/courier` senders + templates | courier `configures` config, events `emits-event` user.created | ☐ |
| 10 | Receive/emit webhooks (Stripe + own) | `@fonderie/webhooks` routes, signature verify | webhooks `secures` invariant, billing `requires` webhooks, rate-limit `secures` (default, the 1.2.0 lesson) | ☐ |

## Verified `requires` graph (extracted from peerDependencies, 2026-07-18)

Programmatically extracted, zero LLM calls — the Phase 1 thesis in miniature.
`requires` = a package's `@fonderie/*` peerDependencies; exports = re-exports
from `src/index.ts`.

| Package | requires | key exports |
| --- | --- | --- |
| core, store, logger, client | — (leaf) | FonderieApp, PGAdapter, Logger, FonderieClient |
| events | core, store | EventBus, EventsModule, MemoryTransport |
| auth | core, events, store (+rate-limit default) | AuthModule, AUTH_CONFIG_KEYS |
| billing | core, store | BillingModule, StripeProvider |
| permissions | core, store | PermissionsModule, PermissionsEngine |
| **workspaces** | **billing**, core, events, store | WorkspacesModule, EVENT_KEYS |
| customers | core, events, store, workspaces | CustomersModule |
| courier | core, events, store | CourierModule, EmailChannel, SmsChannel |
| webhooks | core, events, store | WebhooksModule |
| audit, config | core, store | AuditModule, RemoteConfigModule |
| adapter-express/hono/koa | core, workspaces, permissions, billing | OPERATIONS |

Findings: (1) `workspaces → billing` is a real peer edge — per-seat/team
billing (task 6) is structurally supported, not aspirational. (2) The entire
`requires` edge set is derivable from package.json alone; the `configures`/
`secures`/`billed-by`/`emits-event` edges need light source parsing (config
keys, middleware wiring, event constants) — still LLM-free. This confirms
Phase 1 (`brain build`) is low-risk: the structural spine is a ~30-line
extractor.

## Edge-type inventory implied by the table

`imports`, `requires`, `configures`, `secures`, `billed-by`, `emits-event`,
plus two node kinds beyond code entities: `recipe:*` (canonical wiring
snippets) and `invariant:*` (e.g. "billing webhook route registers before
auth middleware", "auth routes rate-limited by default").

## Alias/synonym edges (R2 seed — grows from corpus misses)

| Alias cluster | Target |
| --- | --- |
| pay, charge, checkout, subscription, pricing, monetize | billing |
| login, signup, sign in, register, SSO, password reset, magic link | auth |
| team, org, organization, workspace, group, invite, member | workspaces |
| role, admin, permission, access, can/cannot, RBAC | permissions |
| email, notify, notification, welcome mail | courier |
| plan gate, feature flag, entitlement, upgrade to unlock | billing + permissions + config |
| throttle, abuse, brute force, spam | rate-limit |
