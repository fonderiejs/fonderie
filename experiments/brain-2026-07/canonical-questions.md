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
