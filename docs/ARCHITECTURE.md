# Fonderie — the architecture map

The one place that answers *what is all this, and which brick do I reach for?*
— for a new contributor, and for the LLM that is Fonderie's real client. The
skill (`.claude/skills/fonderie/SKILL.md`) teaches **how to wire** the bricks;
this file explains **what they are and how they relate**.

> Maintained by hand. Facts-from-source (signatures, outcomes) live in the
> generated brain (see `docs/BRAIN.md`); the *map* lives here.

---

## What Fonderie is

**The self-hosted SaaS backend, assembled by AI.**

The dozen application-layer vendors a SaaS wires together on day one — Auth0,
Stripe-plus-glue, WorkOS, LaunchDarkly, Twilio/SendGrid, Svix, a starter CRM,
an S3 bucket for avatars — collapsed into typed npm bricks that run **in your
process, against your Postgres**. No vendor, no per-seat tax, no data leaving.

Two properties make this ours, not a re-wrap of what exists:

1. **Self-hosted by construction.** *Fonderie never sits in the request path.*
   There is nothing to rent — every brick is `npm install` + an in-process
   `.register()`, running against your own database.
2. **AI-legible by design.** The CLI, the skill, and the brain exist so an
   *agent* can assemble the stack. "Powered by AI" means composable-by-AI, not
   that the bricks think.

### We are not AWS

AWS rents raw infrastructure — compute, network, disks, managed engines. We
sit one layer up: the application backend between raw infra and the product.
This is a line, not a nuance.

**Hold at application-plumbing, never infrastructure.** The moment a brick
tries to *be* infrastructure instead of plumbing for a SaaS, it leaves our
realm and trades the rare thing (coherence) for a fight we can't win on
price/scale (S3, Kafka, Datadog). Two bricks sit near that edge and must stay
scoped:

- **`storage`** serves the other bricks' bytes (avatars via `media`, future
  archives). It is *not* a general-purpose bucket product. Litmus for any
  change: does it serve a Fonderie brick, or chase S3 parity?
- **The telemetry/analytics track** stays consent-safe, PII-safe *product*
  analytics on the events bus. Not APM, not tracing, not Datadog.

### Where a package's job stops

Fonderie covers the boilerplate every SaaS needs on day one. What makes *your*
product different is yours to write — if no `@fonderie/*` brick covers it,
that's the product, not a gap. And the composition rule: **bricks never import
each other**; they talk through `ctx.meta` and receive interfaces
(`IStoreAdapter`, `IBillingProvider`), never concrete classes.

---

## The five tiers

71 packages are not 71 ideas. They are ~18 backend bricks, a client, three
adapters, two tools — and the same UI bricks mirrored across three frontend
frameworks.

| Tier | Packages | Role |
| --- | --- | --- |
| **Foundation** | `core` · `store` · `events` · `logger` | Router + module system, DB abstraction, the event bus, structured logs. Everything sits on these. |
| **Adapters** | `adapter-express` · `adapter-hono` · `adapter-koa` | `bridge()` / `adapt()` / `mount()` — run bricks in the framework the app already chose. |
| **Capability bricks** | `auth` · `permissions` · `workspaces` · `billing` · `courier` · `config` · `audit` · `webhooks` · `customers` · `rate-limit` · `media` · `storage` | The vendor-replacements. The product. |
| **Client & tooling** | `client` · `cli` · `create-fonderie-app` | Typed isomorphic SDK, the agent-teaching CLI, the zero-prompt scaffold. |
| **Frontend mirrors (~45)** | `{react,vue,react-native}-{brick}` (+ `-screens`) | One pattern (see below), not 45 decisions. |

### The dependency direction

Dependencies point one way, toward `core`: `core → store → auth →
permissions`, with `workspaces` and `billing` above `auth`, `courier` above
`workspaces`, `config` above `courier`. Never import from a package that
depends on you.

---

## The frontend mirrors are one pattern

Every capability brick with a UI ships the same shape, across three frameworks:

- **`{framework}-{brick}`** — hooks/composables, thin bindings over
  `@fonderie/client` (e.g. `react-auth`, `vue-billing`, `react-native-workspaces`).
- **`{framework}-{brick}-screens`** — optional pre-built screens on top of the
  hooks (e.g. `react-auth-screens`: login/register/forgot-password).

React is the reference implementation; **Vue** re-derives it; **React Native**
usually **re-exports** the React hooks (`export * from '@fonderie/react-*'`)
and only forks when it needs platform APIs (e.g. `react-native-auth` needs
`AsyncStorage`). The parity contract between the three families is tracked in
`docs/FRONTEND-PARITY.md`.

So "45 frontend packages" reads as one rule: **hooks + optional screens, per
brick, per framework.**

---

## The party model — user vs member vs customer

The confusion most likely to produce wrong code. Three distinct parties, one
hop apart:

```
  auth: USER ───────────── the authenticated principal (fonderie_users).
    │                        Who logs in. One identity.
    │ belongs to
    ▼
  workspaces: MEMBER ────── a user's membership in a workspace/team.
    │                        Roles, invitations. The tenant boundary.
    │ the workspace serves
    ▼
  customers: CUSTOMER ───── a person/business the USER'S BUSINESS serves.
                             A CRM record. Workspace-scoped. NEVER a login.
```

- **user** — `@fonderie/auth`, table `fonderie_users`. The authenticated
  principal; the thing `requireAuth` resolves to `ctx.user`.
- **member** — `@fonderie/workspaces`. A user's belonging to a workspace, with
  a role. Multi-tenancy lives here; `withWorkspace` scopes a route to one.
- **customer** — `@fonderie/customers`. A record of someone the user's
  *business* deals with (individuals/businesses, emails/phones/addresses/notes/
  tags). Workspace-scoped data, **not** an account and never authenticates.

If a design blurs these — "the customer logs in", "the member is billed" —
stop and re-map: logins are users, tenancy is members, CRM records are
customers.

---

## The observability trio — write / curate / observe

`events`, `audit`, and `logger` all touch "what happened" and are easy to
conflate. The split:

- **`events` — write.** The internal bus (memory / Postgres transports,
  adapter interface for Redis/Kafka). How bricks integrate and how domain
  events are emitted.
- **`audit` — curate.** A human-readable **read-model over `events`** for a
  workspace's activity trail (compliance). It is a *view*, not a second store.
- **`logger` — observe.** Operational, structured telemetry for running the
  app (the foundation the telemetry track builds on).

And the egress cousin: **`webhooks`** fans out events to *external* endpoints
(signed, retried) — internal bus (`events`) vs outbound delivery (`webhooks`).

---

## Stability tiers

The version spread is real maturity signal; made explicit here. The durable
source of truth is a `fonderie.stability` field on each backend brick's
`package.json`, read into the brain by the generator (which **enforces** its
presence — a new backend brick can't ship untiered) and exposed per package in
`brain.json`. Frontend mirrors default to `beta`. This table mirrors that
field.

| Stability | Bricks |
| --- | --- |
| **Stable** (5.x–9.x) | `auth` · `billing` · `workspaces` · `courier` · `config` · `permissions` · `webhooks` · `customers` · `audit` · `rate-limit` · adapters |
| **Maturing** (0.x, in use) | `core` · `store` · `events` · `logger` · `client` — foundational and battle-tested, pre-1.0 by version only |
| **Experimental** (early 0.x) | `media` · `storage` — newest bricks; API may move |

Frontend mirrors track their backend brick's maturity but are uniformly early
(0.x) as a family.

---

## Confusable sets — quick reference

| Set | The distinction |
| --- | --- |
| `auth` / `workspaces` / `customers` | user / member / customer (see party model) |
| `events` / `audit` / `logger` | bus / read-model / ops telemetry (see observability) |
| `events` / `webhooks` | internal bus / signed external fan-out |
| `storage` / `media` | content-agnostic bytes / image-domain policy on top (clean layering) |
| `config` secrets | **operator**-level (one app key). Do **not** overload with **tenant**-level secrets (per-user third-party keys) — that is a separate, future concern. |
| `rate-limit` / (future) `risk` | mechanical token bucket / probabilistic signal scoring. `risk` *consumes* `rate-limit`; it must not reinvent it. |

---

For how the brain is generated and kept in lockstep with the code, see
`docs/BRAIN.md`. For the coherence/cleanup plan this map is the first
deliverable of, see `docs/PORTFOLIO-ROADMAP.md`.
