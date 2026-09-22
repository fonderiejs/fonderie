# @fonderie/admin — design spec (for review)

The operator's surface: one reserved place, guaranteed to exist on every
deployment, where the founder answers four questions without reading code or
prompting a model — **what did I deploy, how is it configured, what is
happening, what needs me.** The `/wp-admin` of a Fonderie app.

> **Status: in build — phase 8 of 8 (§9).** Phases 1–7 shipped (`@fonderie/admin`
> 0.5.0, `@fonderie/client` 0.25.0, `react-admin` / `vue-admin` 0.1.0,
> `react-admin-screens` / `vue-admin-screens` 0.1.0). The census in §12 is what existed on
> 2026-09-21, before phase 1.

Companion: `docs/ADMIN-AUTH-SPEC.md` (the token convention this brick
inherits), `docs/OPERATIONS.md` §"Reconciling…" (the five checks this brick
gives a home), `docs/BRAIN.md` (design-time knowledge — this brick is its
run-time counterpart), `docs/PORTFOLIO-ROADMAP.md` P5 (observability split).

---

## 1. The problem, in one line

The model that assembled the app knows what is installed, wired and
configured. The human who deployed it does not — unless they are back in a
development session and can ask.

Concretely, today (verified, see §12):

- The best diagnostic in the portfolio — five drift checks + pending
  migrations + outbox health + email and webhook stats — lives inside
  `POST /internal/cron/purge` in the LeadEasyGen example, gated by
  `CRON_SECRET`, reporting through `console.error` into Vercel logs. The
  founder learns of it only by knowing to curl a cron route.
- `securityReport()` — "which modules are registered, and are they ready" — is
  a method on `FonderieApp`, not an endpoint. There is no route listing, no
  manifest, no runtime "what is installed" anywhere.
- Three bricks expose admin routes under three unrelated conventions. Nothing
  audits admin actions. Nothing gates admin routes in CI.

The data for all four questions exists. There is no *place*.

## 2. What we are and are not copying

### The Sunrise lesson, corrected

The claim "Sunrise Calendar won on unified experience, not on integrating
another calendar" is directionally right and hides the useful half. Sunrise
won as the best *client* over calendars users already had, at the moment
Google Calendar had no iOS app. The integrations were the entry ticket (zero
migration); the unified experience was the product. Both necessary, one
differentiating.

The half people skip: Sunrise owned no data. It was a view over other
people's systems of record — cheap to adopt, and cheap to absorb. Microsoft
bought the view and folded it into Outlook within a year. A unified view over
foreign systems is a feature, not a company.

**This brick is not a Sunrise.** For nearly everything it shows — users,
workspaces, subscriptions as the app sees them, catalog, templates, flags,
the outbox — Fonderie *is* the system of record. Only Stripe and the host
(Vercel) are foreign calendars. So we take "one place, one mental model" and
reject "aggregate everyone's dashboard." Where we overlap a foreign system,
the valuable thing to show is the **intersection — where our copy disagrees
with theirs**. That pattern already shipped five times (#366, #368, #370).
This brick is where those checks get a permanent address.

### What `/wp-admin` actually is

Not its features. It is a *guaranteed, uniform, discoverable* place where the
site owner can see: what's installed (Plugins), how it's configured
(Settings), what's happening (Posts/Comments), what needs attention (Site
Health, update nags). Every WordPress site has it at the same path with the
same shape. That guarantee is the product.

## 3. The name: `@fonderie/admin`

**Decision: `@fonderie/admin`**, with frontend mirrors `@fonderie/react-admin`,
`@fonderie/vue-admin` and their `-screens` packages, per the existing mirror
convention.

Why this word and not another:

1. **Convention.** Bricks are plain capability nouns (`auth`, `billing`,
   `courier`, `config`). The capability is the operator's administration of a
   deployment.
2. **It is the parent of vocabulary that already exists and already means
   "operator-only":** `adminToken`, `requireAdminToken`, `validateAdminToken`,
   the `/admin/*` routes, `react-config-admin`, `react-courier-admin`,
   `ADMIN-AUTH-SPEC.md`, and the CLI's `FONDERIE_ADMIN_URL` /
   `FONDERIE_ADMIN_TOKEN`. A brick that *composes* every brick's admin surface
   is `admin`. No new word for the brain to learn.
3. **The mirrors fall out for free,** and the existing `react-config-admin` /
   `react-courier-admin` read as plugins of `react-admin` — the naming already
   describes the hierarchy.
4. **Prior art is unanimous:** `wp-admin`, `django.contrib.admin`,
   ActiveAdmin, Payload/Strapi/Keystone/Medusa "admin". It is the word an
   integrator — or a model — guesses first.

Rejected:

| Name | Why not |
|---|---|
| `console` | Shadows the JS global — `import { console }` is unusable, and `createConsole` fights the `xModule` convention. Also already means "one per-brick page" in `organization/ui` (`config-console.js`). |
| `ops` | Matches OPERATIONS.md, but reads as infrastructure — and the portfolio holds its line at application plumbing. Does not cover catalog, users or ledger, which are administration, not operations. |
| `dashboard` | Names the UI, not the capability; and §2 is explicitly *not* a dashboard clone. |
| `studio` (Supabase, Prisma, Sanity) | Connotes authoring; names the UI. |
| `manifest`, `doctor` | Each names one endpoint, not the system. |
| `cockpit`, `tower`, `bridge` | `courier` earned a metaphor because "notifications" was ambiguous; "admin" is not. Cockpit is also an existing Linux admin project. |

**The precise category, for the next person who asks (settled 2026-09-21,
after phase 5).** In the networking taxonomy this brick is the app's
**management plane** — configuration, monitoring and administration by
operators — as opposed to the data plane (users' requests) and the control
plane (decisions and reconciliation). It is deliberately *not* a control
plane: it reports, it does not repair (§4). `control` was rejected for
claiming exactly that, and because "control plane" already names config's
versioned write surface in this repo. Kubernetes has no word for a management
slice because its API *is* the whole system; among systems that do have one
— Envoy, Prometheus, Grafana, Kafka, Django, WordPress — the name is `admin`.
`backoffice` was the strongest alternative (covers Tier 1 without stretching)
and was declined to keep the vocabulary the brain already has. Decision:
**keep `admin`**; the description stays "the operator's surface".

Two caveats to state once and move on:

- **"admin" the tenant role vs "admin" the operator.** Workspaces have
  owner/admin/member roles. ADMIN-AUTH-SPEC already fixed the meaning of the
  admin *token* as the operator; this brick inherits it. The panel never means
  a workspace role.
- **`@fonderie/react-admin` vs marmelab's `react-admin`.** Scoped, no npm
  collision; `react-config-admin` already established that nobody reads the
  suffix as marmelab.

## 4. Four principles that decide what is in

Each is already adopted somewhere in the repo; the brick applies them
uniformly.

1. **Read broadly, write narrowly.** Every page reads. Writes are exactly the
   admin routes that already exist (plans, wallet grant, config, secrets,
   templates) plus a very short new list (§7). The panel never invents a
   mutation — its audit surface stays equal to the existing admin routes.
2. **Report, do not repair** (OPERATIONS.md rule), extended to the whole
   panel. Drift is *shown*; the fix is a deliberate act, usually in the
   foreign system, so the page links to the exact object.
3. **Own what you own, link what you don't.** If Stripe, Vercel or Supabase
   already render it, render only our side plus the link. Never a stale copy.
4. **Bricks self-describe.** Each module exports `describeAdmin()` →
   `{ name, version, mount, adminRoutes, checks, pages }`. The shell renders
   from that and never knows package names. A new brick appears in the panel
   by describing itself — the WordPress plugin-registers-its-own-menu model.

## 5. Placement: path, not port; host as defense-in-depth

**Port — rejected.** The primary target (Vercel) is one function, one entry;
Cloud Run is one port per container. A port-based admin works only on a VPS,
the minority case.

**Reserved, configurable path prefix — adopted.** Default `/_admin`,
underscore-prefixed like `/_next` and `/_vercel`. No `@fonderie/*` package
mounts anything under `/_` today (grep-verified 2026-09-21), so it is free by
construction. What matters is that non-collision is a **boot-time assertion,
not a convention to remember**:

- `Router` gains `reserve(prefix)` and `list()`.
- `addRoute` throws if a module mounts under a reserved prefix.
- Core reserves `/healthz`, `/readyz`, `/metrics` and the admin prefix at
  construction.

This is the same shape as `RESERVED_PREFIX_RE = /\bfonderie_/i` in the
migration runner, which already refuses user migrations that touch
`fonderie_*` tables. Future bricks cannot collide because they cannot boot
if they try.

**Host binding — optional.** `admin: { path, host?: 'admin.example.com' }`:
the surface answers only when `Host` matches, else 404. Works on Vercel
(several domains → one deployment) and lets an operator put Cloudflare
Access or any zero-trust proxy in front with no infrastructure.

**Fail-closed by absence — kept** from ADMIN-AUTH-SPEC rule 3. No token ⇒
`/_admin` does not exist (404). Invisible, not locked.

**Honesty about the path.** A configurable path reduces scanner noise; it is
not security. `wp-admin` being well-known is *why* it is the most brute-forced
path on the internet, and the hide-login plugins cut log noise, not risk. Real
security is the token (already constant-time, fail-closed, strength-validated)
+ host binding + an **admin-action audit trail — which does not exist today**
(§7, `/activity/admin-log`).

## 6. The sitemap

Organized by the founder's *question*, not by package. Tiers:

- **T0 — you are not blind.** Pure views over functions that already exist. No
  new subsystem.
- **T1 — what any SaaS operator needs in month one.** A few new admin routes.
- **T2 — convenience / differentiator.**

```
/_admin
├── /                      Attention                          T0
├── /system
│   ├── /modules           what is deployed (the manifest)    T0  ← build first
│   ├── /config            declared vs held                   T0
│   ├── /doctor            the five checks + queue + schema   T0
│   └── /routes            route table + guard class          T0
├── /money
│   ├── /subscriptions     ours vs Stripe, drift classified   T0
│   ├── /webhooks          inbound: registered? moving?       T0
│   ├── /catalog           plans/prices + consistency         T1  ("product catalog")
│   └── /ledger            wallet ledger, purchases, grants   T1  ("transactions")
├── /messaging
│   ├── /queue             outbox pending / dead / drain      T0
│   ├── /sender            SPF / DKIM / DMARC                 T0
│   ├── /deliveries        send outcomes                      T0
│   └── /templates         existing courier-admin             T0
├── /settings
│   └── /flags /config /secrets   existing config-admin       T0
├── /people
│   ├── /users             lookup, sessions, unlock           T1
│   ├── /workspaces        tenants, members, invites          T1
│   └── /customers         CRM records, cross-tenant          T1
├── /activity
│   ├── /audit             cross-tenant + chain integrity     T1
│   └── /admin-log         who did what through here          T1  ← the one new subsystem
├── /access
│   └── /tokens            admin tokens, scopes, rotation     T1
└── /integrations
    ├── /providers         Stripe/SMTP/S3/OAuth: set? reachable?   T2
    └── /outbound-webhooks endpoints + deliveries, all tenants     T2
```

## 7. Justification per node

For each page: the question it answers, the *existing* thing it renders, and
why it lives here rather than in a link-out.

| Page | Question | Renders (existing today) | Why here, not elsewhere |
|---|---|---|---|
| `/` Attention | What needs me today? | Every `ok:false` and every advice finding from `/doctor`; dead letters > 0; drift > 0; pending migrations > 0; readiness problems; weak tokens | wp-admin's update nag is its most-used feature. This is the page opened daily. **Computed from the same functions as `/doctor`** so the two can never disagree. Empty = green. |
| `/system/modules` | What did I deploy? | `securityReport()` promoted to an endpoint + each module's `describeAdmin()`: version, mount prefix, adminToken set?, readiness; running version (`VERCEL_GIT_COMMIT_SHA` when present) | **The manifest.** The smallest thing that closes the blindness gap — curl it and you know what you shipped. Also what a model needs at run time (§9). |
| `/system/config` | Is it configured? | `checkProductionReadiness()` problems per module; env **presence** — declared-by-module vs set — never values; last reconciliation results | #370 made visible. Presence not values because the process cannot restart itself; editing belongs to the host — link out. |
| `/system/doctor` | Is it *semantically* working? | On demand: `checkWebhookRegistration`, `checkPriceConsistency`, `checkSubscriptionDrift`, `checkSenderDns`, `MigrationRunner.pending()`, outbox dead/pending, `webhookStats`, `messageStats` — each with its `describe…Problems` lines; `ok` separated from advice | This *is* the LeadEasyGen cron route given a permanent address and the admin token instead of `CRON_SECRET`. Not uptime: an app cannot observe its own downtime; that stays external by definition. |
| `/system/routes` | What is exposed? | `Router.list()` — method, path, guard class (public / session / admin / cron) | Security legibility: see at a glance that `POST /plans` is admin-guarded and `/billing/webhook` is public by design. Runtime counterpart to `check:routes`, which excludes admin routes today. Near-free once `list()` exists for prefix enforcement. |
| `/money/subscriptions` | Who is paying — and does Stripe agree? | `fonderie_subscriptions` + drift class (over-granting / under-granting / metadata) + link to the Stripe object | The intersection. Stripe shows *its* side; only we can show the disagreement, and "a cancelled subscriber still served" is a money bug Stripe will never flag. |
| `/money/webhooks` | Is money reaching me? | Registration check (events handled vs registered, API version) + last-accepted-event timestamps | A stale webhook secret is the outage where Stripe reports success and we credit nothing. Stripe's dashboard shows 400s in a log; only our side knows the *consequence*. |
| `/money/catalog` · T1 | What am I selling? | DB plans via the existing `/plans` CRUD (admin routes with **no UI today**) + `checkPriceConsistency` | The "product catalog / inventory" need. The one place the panel writes to money — to *our* catalog, never to Stripe; the consistency check says when they diverge. Renders whichever the app uses (config catalog or DB plans). |
| `/money/ledger` · T1 | What moved? | Wallet ledger, purchases, grants (`/billing/wallet/grant` — existing, no UI) + link to the Stripe invoice | The "transactions" need, from the ledger customers are actually served from (idempotency-keyed). The grant button is the one write, already an admin route. |
| `/messaging/queue` | Is the outbox draining? | `pendingByConsumer`, `deadLetters`, last drain result / error | "A queue that cannot be consumed at all looks identical to an idle one." Dead rows never deliver and nobody queries the table. |
| `/messaging/sender` | Will my mail land? | `checkSenderDns`, advice separated from `ok` | #366. Provider accepts, receiver drops — invisible from both dashboards. |
| `/messaging/deliveries` | Did it send? | `messageStats` + per-message outcomes from courier's log | Courier catches send failures without rethrowing, so the outbox marks the row processed. An SMTP rejection looks like success everywhere except courier's log — this is the only page that reads it. |
| `/messaging/templates`, `/settings/*` | — | Existing courier-admin and config-admin dashboards, mounted in the shell | Already decided to be admin. The shell's value is that they stop being separate apps with separate tokens the founder must wire. |
| `/people/users` · T1 | Why can't this customer log in? | Lookup by email; sessions, MFA state, lock state, login activity (`AUTH-LOGIN-ACTIVITY-PLAN.md`), memberships, subscription. Writes: revoke sessions, unlock | The first support ticket every SaaS receives. Needs new admin routes on `auth` (none exist). **Impersonation excluded until `/admin-log` exists.** |
| `/people/workspaces` · T1 | Same, tenant-shaped | Tenants, members, invites, plan | Same justification. |
| `/people/customers` · T1 | — | Cross-tenant view of the customers brick | Lowest priority: the user-facing CRUD is complete; this is only the operator's cross-tenant angle. |
| `/activity/audit` · T1 | What happened? | Cross-tenant `@fonderie/audit` viewer + `verifyEventChain` result | User-facing audit screens are workspace-scoped; the operator needs all tenants and needs to know the chain is intact (OPERATIONS.md, integrity monitoring). |
| `/activity/admin-log` · T1 · **new** | Who did what through here? | Every admin-route hit — actor, route, outcome — including secret reveals and failed auth | Today admin actions are unaudited and `POST /admin/secrets/:key/reveal` leaves no trace. **A panel that reveals secrets cannot ship without this.** Implement inside `requireAdminToken` (emit an event) so it covers the CLI too, not just the panel. |
| `/access/tokens` · T1 | Who can be here? | Today: which modules have a token set, strength status. Next: multiple tokens, scopes (read / write / secrets), expiry, rotation without redeploy | Today revocation = redeploy, and three bricks = three tokens. The panel itself needs *one* token spanning bricks, which the spec's one-token-per-module rule does not cover — that forces the unification (§11 Q1). Fold the events worker's local bearer in. |
| `/integrations/*` · T2 | Is Stripe / SMTP / S3 / OAuth set up and reachable? | Provider status + link to each console; outbound-webhooks admin view across tenants | Where a founder *wants* "one place" — but reachability probes cost network calls and most of it is already in `/system/config` + `/doctor`. Convenience, not blindness. After T1. |

## 8. Deliberately not on the map

| Not built | Why |
|---|---|
| Traffic / uptime / downtime graphs | An app cannot report its own downtime — external monitor by definition (OPERATIONS.md already says so). Per-route traffic needs a metrics store that does not exist (telemetry roadmap phase 3). `/metrics` exists for Prometheus; link to whatever scrapes it. |
| Env var editing | The process cannot restart itself; the host owns it. Show presence, link out. |
| Deploys / versioning / rollback | The host's. Show the running version on `/system/modules`; never control it. |
| Database browser | Supabase Studio / pgAdmin. Never. |
| Bugs / errors | Needs error capture + grouping (telemetry roadmap phase 2). Phase 1 shipped `requestId` end to end, so when phase 2 lands `/activity` gains `/errors`. Not before. |
| Editing Stripe objects | Report, do not repair. Link to the object. |

## 9. Build order — and why the manifest comes first

**First: `GET /_admin/manifest`.** JSON, admin-token guarded, fail-closed:
`securityReport()` + `describeAdmin()` per module + `Router.list()` + the
doctor results. Before any UI.

1. It is the smallest thing that ends the founder's blindness — curl it and
   you know what you deployed, how it is configured, and what is wrong.
2. The UI shell renders from it, so the shell is generic and bricks
   self-describe.
3. **It is the run-time brain.** `docs/BRAIN.md` is design-time knowledge for
   the model; the project skill knows what is *installed* at code time;
   nothing on either side knows what is *running and healthy*. The manifest
   is read by the human through the panel and by the model through curl or a
   `brain-serve`-style MCP. That is the real unification this brick performs —
   not calendars, but the human/model split in §1: the model's implicit
   picture of the deployment becomes an explicit artifact both can read.

### One owner, one mounter (amendment, 2026-09-21)

The first draft of this order had config, courier and billing each move their
own admin routes under `/_admin`. That cannot work with `reserve()` as built:
a prefix has **one** owner, and if three bricks mount under `/_admin` nobody
owns it — a stranger can still mount `/_admin/anything`, which is the exact
hole the namespace exists to close.

So: **`@fonderie/admin` is the sole owner and sole mounter of `/_admin`.**
Bricks never `addRoute` under it. They *describe* their admin routes
(principle 4) and the admin brick mounts them under its prefix, behind its
one guard. Consequences:

- **Q1 is settled by structure, not by spec amendment.** The admin module's
  `adminToken` is *the* admin token — the panel needs one, and one module owns
  all the routes it guards. ADMIN-AUTH-SPEC rule 1 (one token per module) is
  untouched: the admin module is a module. The per-brick tokens keep guarding
  the legacy standalone routes (`/admin/config`, `/plans`, …) until those are
  removed in a later major; then the per-brick options go with them.
- Admin-log (phase 5) needs **no core change**: the admin brick logs every
  request it serves. The legacy standalone routes stay unlogged until removed.
- A brick works standalone without the admin brick exactly as today. Install
  the admin brick and the same handlers also appear under `/_admin`.

### Phases

Each phase is one PR through the release train, shipped and npm-verified
before the next starts.

| # | Phase | Delivers | Status |
|---|---|---|---|
| 1 | **Namespace** | `app.reserve()`, `app.routes()`, `Router.reserve/list`; probe paths reserved at construction | **shipped** — core 0.16.0 (#371) |
| 2 | **The place exists** | `@fonderie/admin`: reserves the prefix, one token (fail-closed by absence, strength-validated), `GET /_admin/manifest` — modules, versions, readiness *with* problems, the route table. `version?` on `IFonderieModule`. | **shipped** — admin 0.1.0, core 0.17.0 (#373) |
| 3 | **Composition** | `describeAdmin?()` on `IFonderieModule` → `{ routes }` and `app.adminDescriptions()`; config, courier, billing implement it with *unguarded* handlers from the same table as their legacy routes; admin mounts them under `/_admin/{config,secrets,templates,plans,wallet/grant}` behind its token, and refuses two modules describing one path. Manifest reports `describesAdmin` per module. Legacy paths deprecated in docs and changelog, not removed. | **shipped** — admin 0.2.0, core 0.18.0, config 5.2.0, courier 7.7.0, billing 9.8.0 (#375) |
| 4 | **Doctor** | `describeAdmin().checks` → `IAdminCheck { name, run() → { ok, findings, skipped? } }`. billing (price consistency, subscription drift, webhook registration — the last only with the new `config.publicUrl`), courier (sender DNS, with optional `email.senderDns` for DKIM selectors / return-path), events (outbox: dead letters fail, stale backlog advises). `AdminModule({ checks })` for what no module owns (pending migrations). `GET /_admin/doctor`: every check, per-check timeout, a throw becomes a finding, `ok` only for hard failures. `GET /_admin`: attention = readiness problems + failed checks as errors + findings on passing checks as advice; empty is green. Stats (`webhookStats`, `messageStats`) are instruments, not checks — they belong to pages (phase 6/8). | **shipped** — admin 0.3.0, core 0.19.0, billing 9.9.0, courier 7.8.0, events 5.6.0 (#377) |
| 5 | **Admin-log** | `AdminModule({ store })` + one migration: `fonderie_admin_log` — actor (`X-Actor`), method, path, route, module, status, duration, request id, client IP — written by a middleware that sits *before* the guard, so a refused request is a row too; a failed write never fails the request. `GET /_admin/activity/admin-log`, newest first, keyset-paged. Manifest reports `admin.log: false` when no store is given. Unlocks secret reveal and, later, impersonation. | **shipped** — admin 0.4.0 (#379) |
| 6 | **Rest of T0 + CLI** | `/_admin/config`: readiness per module + env *presence* from `AdminModule({ env })` — bricks never read `process.env` (config is injected), so only the app can name what matters; values are never shown. `/_admin/routes`: every route with a guard class — `admin` (behind this token), `probe` (core's health routes), `app` (everything else; session-vs-public is not derivable without tagging `requireAuth`, so it is not claimed). `/_admin/access/tokens`: the admin token's readiness verdict + which bricks still register a legacy standalone surface (inferred from the route table). CLI: `fonderie admin <attention\|manifest\|doctor\|config\|routes\|tokens\|log>`, `FONDERIE_ADMIN_PREFIX` when moved. | **shipped** — admin 0.5.0, cli 0.4.0 (#381) |
| 7 | **Shell** | §10, in three steps that each reuse the previous. **7a** `AdminClient` in `@fonderie/client` (sibling of `ConfigAdminClient`, plus `prefix`) + `react-admin` / `vue-admin`, one hook per page — the coverage gate's leg 1 now verifies every client method has a hook. **7b** `react-admin-screens` / `vue-admin-screens`: the shell (navigation = the sitemap) and the pages with no home yet — attention, modules, doctor, routes, config, tokens, admin log — composing the existing `*-config-admin-screens` and `*-courier-admin-screens` as sub-pages; those two clients gain a `prefix` option so they can sit under `/_admin` with the one token. **7c** (optional) the same screens built once to a static bundle served by `AdminModule({ ui: true })` at `/_admin/ui` — the zero-config story; Cloud is the same components hosted. | **7a + 7b shipped** — client 0.25.0, react-admin / vue-admin 0.1.0 (#383), react-admin-screens / vue-admin-screens 0.1.0 (#385). 7c deferred until the zero-config story is asked for. |
| 8 | **T1** | In slices, each a PR. **8a people/users** — `@fonderie/auth` describes `GET /users?email=`, `GET /users/:id`, `GET\|DELETE /users/:id/sessions`, `GET /users/:id/login-history`, `POST /users/:id/{suspend,unsuspend}`; the first brick whose admin surface exists *only* through composition (no standalone routes, no per-brick token). The lock is `users.suspended`, which login, refresh and the session middleware already enforce. Impersonation stays out. CLI `fonderie admin user <email\|id> [sessions\|history\|revoke-sessions\|suspend\|unsuspend]`. **8b** its client + hooks + `UsersScreen` in both shells (`AuthAdminClient`, `useAdminUser` / `useAdminUserSessions` / `useAdminLoginHistory`, a People group in the shell that appears when `authClient` is given). **8c** money — billing describes the reads: `GET /catalog` (plans as configured *and* as stored, so a divergence is visible), `GET /subscriptions/:type/:id`, and with `config.wallet` `GET /wallet/:type/:id` + `/ledger` (the user-facing DTOs; bigints as strings). The writes were already described in phase 3. CLI `fonderie admin catalog` and `admin subscriber <user\|workspace> <id> [subscription\|wallet\|ledger]`. Then its client + hooks + Money pages in both shells. **8d** audit — `@fonderie/audit` describes `GET /audit`: the same filters and DTO as the workspace-scoped route, with `workspaceId` optional (every workspace unless one is named); `@fonderie/events` offers `events.integrity` to the doctor (`verifyEventChain`: a tampered row fails, rows published before the key are advice, no key ⇒ skipped and says so). CLI `fonderie admin audit [--workspace] [--type] [--actor] [--from] [--to]`. Then its client + hook + `AuditScreen` in both shells. **8e** tokens with scopes and rotation. **8f** legacy standalone admin routes removed (major on config, courier, billing). | 8a shipped — auth 7.8.0, cli 0.5.0 (#387); 8b shipped — client 0.26.0, react-admin / vue-admin / *-screens 0.2.0 (#389); 8c-server shipped — billing 9.10.0, cli 0.6.0 (#391); 8c-ui shipped — client 0.27.0, react-admin / vue-admin / *-screens 0.3.0 (#393); 8d-server in PR |

### Core vs brick

| Lives in `@fonderie/core` | Lives in `@fonderie/admin` |
|---|---|
| `Router.reserve()` / `list()` (shipped) | Owning and mounting the reserved prefix (+ optional host binding) |
| `version?` and `describeAdmin?()` on `IFonderieModule` | The one guard; `/manifest`, `/doctor`, `/routes` |
| `securityReport()` (exists) | Mounting described routes and checks from every brick |
| | Admin-log store and page |
| | Token model (scopes, rotation) |
| | Optional static UI serving |

Same split as `requireAuth` in core vs the routes in `auth`. Core stays
dependency-free: it defines the description contract and never reads it.

## 10. The UI: two consumers of one API

The JSON surface is the product. Two consumers:

- **(a) OSS default.** The API optionally serves a static shell at `/_admin`
  — the wp-admin model, "it is just there after deploy". `organization/ui/`
  (zero-build HTML + vanilla JS consoles for config / secrets / templates) is
  the direct ancestor; it becomes the shell, driven by the manifest instead of
  hard-coded to three routes.
- **(b) Fonderie Cloud.** A hosted dashboard that connects to any deployment's
  `/_admin` with a token — the Vercel / Supabase Studio model. Per
  `organization/MONETIZATION.md` ("Cloud is the destination"), this is the
  natural paid layer, and it is the *same API*, so nothing forks.

Do not decide (a) vs (b) now. Decide the API.

## 11. Open questions (gate implementation)

**Q1 — One token or per-module tokens?** *Resolved* by the one-owner
amendment in §9: the admin module's token is the admin token, because the
admin module mounts every route it guards. No spec amendment. The events
worker's out-of-spec bearer (`events/src/worker.ts`) is folded in when its
`/health` and `/drain` become described routes (phase 4).

**Q2 — Is `describeAdmin()` required or optional on `IFonderieModule`?**
Optional in phase 3 (additive, no major on fifteen bricks), and the manifest
reports per module whether it describes anything — so silence is visible, not
mistaken for "nothing to administer". Revisit making it required when the
last brick implements it.

## 12. Census — what exists today (2026-09-21)

Every claim above rests on this. File references are `path:line` at commit
`2ec096c1`.

### Admin routes (admin-token guarded)

| Package | Routes | Convention |
|---|---|---|
| `@fonderie/billing` | `POST /plans`, `PUT|DELETE /plans/:planId`, `POST /billing/wallet/grant` (`billing/src/routes.ts:103-135`) | **Inline among data-plane paths** — indistinguishable from public routes by URL |
| `@fonderie/config` | `GET /admin/config`, `GET|PUT|DELETE /admin/config/:key`, `…/revisions`, `…/rollback`; same shape for `/admin/secrets`, plus `POST /admin/secrets/:key/reveal` (`config/src/admin.ts:107-207`) | Bare `/admin/*` |
| `@fonderie/courier` | `GET /admin/templates`, `GET|PUT|DELETE /admin/templates/:type`, `…/revisions`, `…/rollback` (`courier/src/templates/admin-routes.ts:50-95`) | Bare `/admin/*` — **co-owns the prefix with config** |

Fail-closed registration is uniform: routes are pushed only when
`adminToken` is set (`billing/src/routes.ts:101`, `config/src/module.ts:29`,
`courier/src/module.ts:89`).

### Health, readiness, diagnostics

- Auto-registered by core unless `healthChecks: false`, **public**, bypassing
  `addRoute` (`core/src/app.ts:229-280`): `GET /healthz` (liveness),
  `GET /readyz` (aggregates every module's `checkReadiness()`; problem details
  suppressed in prod unless `exposeReadyzDetails`), `GET /metrics` (Prometheus,
  only with `config.metrics`).
- `securityReport()` (`core/src/app.ts:207`): registered module names +
  readiness — a method, not an endpoint. `checkProductionReadiness()` (:196),
  `enforceProductionReadiness()` (:284).
- Async checks, exported but **routed by no package**: `checkWebhookRegistration`
  / `describeWebhookProblems` / `webhookStats` (`billing/src/services/provider-health.ts`),
  `checkPriceConsistency` (`billing/src/services/price-consistency.ts`),
  `checkSubscriptionDrift` / `describeSubscriptionDrift`
  (`billing/src/services/subscription-drift.ts`), `checkSenderDns` /
  `describeSenderDnsProblems` (`courier/src/sender-dns.ts`), `messageStats`
  (`courier/src/log.ts`), `MigrationRunner.pending()`
  (`store/src/migrations/runner.ts:81`).
- The only place all of them are wired: `examples/leadeasygen/microservices/api/src/fonderie.ts:447`
  — a `POST /internal/cron/*` route guarded by `CRON_SECRET`, not the admin
  token, reporting via `console.error`.
- The events worker runs its own HTTP server with `GET /health` and
  `POST /drain` behind a **local** bearer compare (`events/src/worker.ts:177,184`)
  — a fourth token model outside the spec.
- No `doctor` command exists in the CLI or any package.

### Router

`FonderieApp.addRoute()` (`core/src/app.ts:330`) prepends `config.basePath`
and pushes into `Router` (`core/src/router.ts:4-9`): a private flat array with
`add()` and `match()` only. **No `list()`, no duplicate detection, no reserved
prefix.** First match wins. The precedent for a reserved namespace is the DB
side: `RESERVED_PREFIX_RE = /\bfonderie_/i` (`store/src/migrations/runner.ts:7`).

`check:routes` (`scripts/check-client-routes.mjs`) is a static diff of client
calls vs server routes for auth/billing/customers/workspaces/webhooks and
**explicitly excludes both admin surfaces** (:11-13). Nothing gates admin
routes.

### Existing admin UIs

- `react-config-admin(-screens)`, `react-courier-admin(-screens)`,
  `vue-config-admin(-screens)`, `vue-courier-admin(-screens)`. Hooks take a
  pre-built `ConfigAdminClient` / `CourierAdminClient` (`@fonderie/client`,
  constructed with `{ baseUrl, adminToken, actor? }`). Token storage is the
  integrator's problem; nothing in the repo stores or scopes it.
- **No admin UI for billing's `/plans` or wallet grant.**
- `organization/ui/` (parent repo): zero-build static consoles for config,
  secrets, templates — hard-coded to those three routes.

### Token model

Per `docs/ADMIN-AUTH-SPEC.md` and `core/src/middlewares/require-admin-token.ts`:
one static string per module (billing keeps deprecated `planAdminToken` /
`wallet.adminToken` fallbacks). **No scopes, expiry, rotation or revocation** —
revocation is a redeploy. Bearer prefix, constant-time compare, identical 401
for missing and wrong. Strength (`validateAdminToken`, ≥32 chars, placeholder
reject) is now called from all three bricks — the spec's conformance table
(F1, F2) is stale on that point.

**Audit: none.** `@fonderie/audit` is not imported by config, courier or
billing. No admin route emits an event; reads — including secret reveal —
leave no trace; failed admin auth is not recorded. The only attribution is the
optional `X-Actor` header, defaulting to the literal `'admin-token'`
(`config/src/admin.ts:32`, `courier/src/templates/admin-routes.ts:25`),
persisted as `updated_by` on write revisions.

CLI counterpart: `fonderie config|secret|template <verb>` drives the live
admin API with `FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`
(`packages/cli/bin/fonderie.mjs:292-299`).

### Introspection

None at run time. Build time only: `packages/cli/data/knowledge.json`
(capability → package, powers `fonderie query --concepts`) and the
`scripts/check-*.mjs` static coverage diffs.

### Namespace availability

No `@fonderie/*` package mounts any path beginning with `/_` (grep over
`packages/*/src`, 2026-09-21). The only explicit prefix anywhere is
`basePath: '/v1'` in three places.
