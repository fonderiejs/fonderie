# Fonderie.js — 6-Month Roadmap

> **Horizon: 2026-05-14 → 2026-11-14**
>
> fonderie-js is not the product. It is the speed advantage that lets you deliver
> SaaS faster than a team of five and keep the client forever.
> The framework matures by building real projects on it — not by designing it in isolation.

---

## Thesis

Four SaaS billing archetypes cover 90% of all commercial products:

| # | Archetype | Example domains |
|---|---|---|
| A | **Workspace billing** — team pays, not individual | Field service, project management, B2B tools |
| B | **User billing** — individual subscription | Personal finance, solo scheduling, creator tools |
| C | **Credit / token system** — pay for capacity, spend on operations | AI features, SMS campaigns, document processing |
| D | **Freemium + guest migration** — anonymous → authenticated | Quoting tools, configurators, consumer products |

Each archetype is validated by shipping a **real paying project** on it.
fonderie does not graduate to open promotion until all four archetypes have live production traffic.

---

## Revenue Model

| Stream | Mechanism | Target (month 6) |
|---|---|---|
| Client delivery fees | One-time or milestone billing for building the SaaS | $15,000–25,000 total |
| Monthly retainers | Hosting, maintenance, feature iteration | $3,000–6,000 MRR |
| Future: fonderie licence | Once battle-tested, commercial or open-core licence | not before month 9 |

The goal at month 6 is **3 live clients** generating **$3k+ MRR**.
That is the number that de-risks the next 12 months and funds bigger bets (medical imaging, etc.).

---

## 6-Month Timeline

### Phase 1 — M1–2 · Archetype A · Workspace billing
**Project:** crewfinding (field service, React Native, bilingual EN/FR)

Client pays for a workspace. Workers join as members with roles and permissions.
Job lifecycle: estimates → work orders → invoices.

**fonderie work (hardening existing packages):**
- Complete GAME_PLAN.md steps 0–4 (core → store → auth → permissions → workspaces)
- Key fixes: `X-Workspace-ID` header resolution, multi-role `BOOL_OR` aggregation,
  `fonderie_users` schema gaps, personal workspace auto-provisioning
- Harden courier (FSTemplateResolver, message log, delivery webhooks)
- Changesets installed — begin semver discipline at `0.1.0`

**Gate:** One paying client live. $500–2,000/month. Any amount validates the archetype.

---

### Phase 2 — M2–3 · Archetype C · Credit / token system
**Project:** Any client needing usage-based operations (AI generation, SMS, OCR, storage)

User or workspace purchases a credit bundle. Each platform operation consumes credits.
Credits top up via Stripe, expire on configurable schedule, alert on low balance.

**fonderie work:**
- `@fonderie-js/credits` — new package: ledger table, debit/credit transactions,
  `requireCredits(n)` middleware, top-up endpoint, balance endpoint
- Extend `@fonderie-js/billing` — usage metering (`recordUsage`, metered Stripe subscriptions)
- `@fonderie-js/queue` shell — background jobs for credit expiry and low-balance alerts

**Gate:** Usage-based client live with real Stripe charges flowing through credits ledger.

---

### Phase 3 — M3–4 · Archetype B · User-level billing
**Project:** Individual SaaS — freelancer tool, personal scheduler, solo creator product

One person pays for their own account. No workspace required.
`resolveSubscriber` resolves at `user` scope when no workspace is present.

**fonderie work:**
- Verify and stress-test `billing.resolveSubscriber` at user scope
- `@fonderie-js/client` — typed isomorphic client, generated from package DTOs
- `@fonderie-js/storage` — file uploads with S3/R2/local abstraction, signed URLs
- OpenAPI skeleton — auto-generate spec from registered route tree

**Gate:** Individual subscriber charged monthly through fonderie billing without workspace context.

---

### Phase 4 — M4–5 · Archetype D · Freemium + guest migration
**Project:** Consumer-facing product — quoting tool, configurator, anything with a public flow

Anonymous session → email signup → all guest data migrates to the real account.
Product is usable without creating an account. Guest sessions are ephemeral but migratable.

**fonderie work:**
- Extend `@fonderie-js/auth` — `guest_id` on sessions, `migrateGuestToUser(guestId, userId)`
  transactional migration, ownership transfer across related tables
- `@fonderie-js/notifications` — in-app notification feed, read/unread state
- `@fonderie-js/audit` — immutable append-only activity log (compliance evidence,
  visible activity feeds, data subject export)
- `@fonderie-js/webhooks` — outbound webhooks so clients can subscribe their own
  endpoints to fonderie events

**Gate:** Guest session survives signup and all associated data migrates atomically.

---

### Phase 5 — M5–6 · Repeatability + ecosystem hardening
**Project:** Second client on Archetype A (workspace billing) — different industry

The first repeat client on an existing archetype is the real proof of concept.
It will expose every assumption that was baked into crewfinding.

**fonderie work:**
- Fix everything that broke or felt awkward building the second archetype-A client
- `@fonderie-js/compliance` — GDPR data subject requests, PII masking, retention policies
- `fonderie` CLI — scaffold new project, run migrations, sync plans
- Versioning: cut `0.2.0` across all packages, publish to npm privately or publicly

**Gate:** Second workspace-billing client live with $0 crewfinding-specific code in fonderie.

---

## Package Evolution by Phase

```
         M1   M2   M3   M4   M5   M6
core     ████ ████
store    ████ ████
auth     ████ ████           ████
perms    ████
workspaces ████
courier  ████ ████
billing  ████ ████ ████
config        ████
credits        ████ ████
queue          ████
client               ████ ████
storage              ████
notifications              ████ ████
audit                      ████ ████
webhooks                   ████
compliance                      ████
CLI                              ████
```

---

## Versioning & Repo Strategy

**Now → Month 3:** rolling `0.0.x` development, all packages move together.
Install Changesets immediately — every PR that changes a public API gets a changeset entry.
This builds the discipline before it matters.

**Month 3:** cut `0.1.0` across all packages after Archetype A is live.
This is the first "I'd build on this" milestone.

**Month 6:** cut `0.2.0` after all four archetypes are validated.
This is the first "I'd recommend this to someone else" milestone.

**Monorepo stays monorepo** until one of these is true:
- An external contributor owns a specific package
- A package needs an independent release cadence
- Legal needs different licence terms per package

If/when split, use Nx or Turborepo — not git submodules.
The `@fonderie-js/development` umbrella repo concept is the right end state,
but it is a month-12 problem, not a month-6 problem.

**npm dist-tags to use:**
```
latest   → stable, all four archetypes validated
next     → pre-release, between milestones
```

---

## Competitive Positioning

| Competitor | Their story | Why we're different |
|---|---|---|
| Supabase | Fully hosted BaaS, massive ecosystem | We're code-first, self-hosted, no vendor lock-in |
| Clerk | Best-in-class hosted auth | We own the auth table, no per-MAU pricing |
| Better Auth | TypeScript auth library, closest sibling | We go further: billing, workspaces, events, credits |
| Payload CMS | TypeScript-first backend + CMS | CMS-centric; we're SaaS-infrastructure-centric |
| AppWrite | Self-hosted BaaS, Docker-deploy | GUI-centric; we're code-first and composable |

**The pitch to clients (now):**
> "I ship your SaaS in 6–8 weeks instead of 6 months because I've already
> built the auth, billing, permissions, and event infrastructure. You pay
> for what makes your product different."

**The pitch to developers (month 9+, once battle-tested):**
> "Own your auth, own your billing, own your events. Typed, self-hosted,
> framework-agnostic. The first 3 months of every SaaS, already built."

**Do not go to California before month 6.** You need three live products, a demo,
and a defensible MRR number before that trip has ROI.

---

## Hard Gates (go / no-go)

| Date | Gate | If not met |
|---|---|---|
| 2026-07-14 | One paying client live on Archetype A | Do not start Archetype C — fix what blocked the first client |
| 2026-08-14 | Credits ledger processing real Stripe charges | Descope credits, find simpler usage-based client |
| 2026-09-14 | User-scope billing working end-to-end | Fold into Archetype A if no individual-billing client found |
| 2026-10-14 | Guest → user migration working atomically | Descope freemium, move to hardening |
| 2026-11-14 | 3 live clients, $3k+ MRR | Re-evaluate commercial timeline before any public launch |

---

## Blind Spots to Actively Watch

1. **No error monitoring story.** What happens when `fonderie.handle()` throws in production?
   Wire Sentry or equivalent before the first client goes live.

2. **No migration story for existing apps.** If a client already has users in a custom table,
   how do they adopt fonderie? This is a real sales objection that needs an answer by month 3.

3. **`defineResource()` is the north star DX and it does not exist yet.**
   Until it does, fonderie is "assemble it yourself infrastructure," not a developer product.
   Target: shipped by month 5 as part of CLI work.

4. **Documentation is zero.** That is acceptable while you are the only consumer.
   The moment a second developer touches this codebase, the first blocker is docs.
   Minimum viable: each package has a README with a working 10-line example by month 4.

5. **No pricing model for fonderie itself.** Decide before accidentally open-sourcing
   the monetization engine. Candidates: MIT (full open), BSL-1.1 (open but no competing SaaS),
   open-core (packages free, hosted dashboard paid). Choose by month 6.

---

## Success Criteria at Month 6

- [ ] 3 clients live in production on fonderie infrastructure
- [ ] All 4 billing archetypes validated by real transactions
- [ ] $3,000+ MRR from retainers
- [ ] 0 crewfinding-specific code inside any fonderie package
- [ ] `0.2.0` published with Changesets changelog
- [ ] Every package has a README with a working example
- [ ] Sentry or equivalent wired in at least one production deployment
- [ ] `defineResource()` API designed (does not need to be fully implemented)

---

## Package Inventory

> **16 packages ship today. 375 tests, 0 failures.**
> See `GAME_PLAN.md` for the technical execution detail on each package.

### Foundation — 2 packages

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/core` | Request router, middleware pipeline, module system, `IFonderieContext`, typed `ctx.meta`, parser utils, response helpers | 19 |
| `@fonderie-js/store` | `IStoreAdapter` interface, `PGAdapter`, `MigrationRunner`, `sql` tagged-template, `createMigrationsPath` | 12 |

### Identity & Access — 2 packages

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/auth` | Email/password, phone OTP, Google OAuth, stateless JWT, TOTP MFA + backup codes, password recovery, email verification, user profile | 121 |
| `@fonderie-js/permissions` | RBAC engine, CRUD-bit permission keys, `requirePermission` middleware, `BOOL_OR` multi-role aggregation, super-role bypass | 14 |

### Collaboration — 1 package

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/workspaces` | Workspace CRUD, member management, multi-role assignments, custom roles + seeded system roles, token/PIN invitations, `X-Workspace-ID` context resolution, personal workspace DMZ | 28 |

### Revenue — 1 package · 1 planned

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/billing` | Config-driven plan catalogue, Stripe subscriptions, polymorphic user/workspace billing, usage metering + rate limits, plan admin (POST/PUT/DELETE), `requirePlan` / `requireFeature` / `getPlanLimit` middleware | 57 |
| `@fonderie-js/credits` | Credit ledger, debit/credit transactions, `requireCredits` middleware, top-up endpoint, balance endpoint | ⬜ Phase 2 |

### Communication — 1 package · 1 planned

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/courier` | Transactional email/SMS/push, FS + DB template resolvers, multi-channel routing, `fonderie_message_log`, inbound delivery webhooks (SendGrid, Mailgun, Mailtrap) | 18 |
| `@fonderie-js/notifications` | In-app notification feed, read/unread state, type-based filtering | ⬜ Phase 4 |

### Eventing — 1 package

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/events` | `EventBus`, `MemoryTransport`, `PGTransport` (SKIP LOCKED, per-consumer), wildcard patterns, `NOTIFICATION_EVENT` constant, typed event keys convention | 12 |

### Observability — 2 packages · 1 planned

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/logger` | Structured logging, log levels, `ConsoleTransport`, `FileTransport`, pluggable transport interface, `LoggerModule` | 14 |
| `@fonderie-js/audit` | Immutable append-only activity log (`fonderie_audit_events`), workspace-scoped, cursor-based pagination, `GET /audit` route | 19 |
| `@fonderie-js/compliance` | GDPR data subject requests, PII masking, retention policies, SOC2 evidence collection | ⬜ Phase 5 |

### Infrastructure — 3 packages · 2 planned

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/config` | DB-backed remote config, per-environment overrides, TTL-based hot reload, `getConfig` helper, `RemoteConfigModule` | 17 |
| `@fonderie-js/webhooks` | Outbound webhooks — endpoint registration, HMAC-SHA256 signed delivery, delivery log, retry tracking, `EventBus` integration | 11 |
| `@fonderie-js/storage` | File uploads, provider abstraction (S3/R2/local), signed URLs, size/type validation | ⬜ Phase 3 |
| `@fonderie-js/queue` | Background jobs, scheduled tasks, configurable retries, dead-letter handling | ⬜ Phase 2 |

### Distribution — 1 partial · 2 planned

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/client` | Isomorphic TypeScript client — `FonderieClient`, `AuthClient` with typed inputs/outputs | 🔨 auth module only |
| `fonderie` CLI | Scaffold new projects, generate module boilerplate, run migrations, sync plans | ⬜ Phase 5 |
| OpenAPI generator | Auto-generate OpenAPI v3 spec from registered routes and DTOs | ⬜ Phase 3 |

### Framework Adapters — 3 packages

| Package | What it does | Tests |
|---|---|---|
| `@fonderie-js/adapter-express` | Express 5 — `mount()`, `bridge()`, `adapt()`, pre-adapted `requireAuth` / `withWorkspace` / `requirePermission` / `requireFeature` | 17 |
| `@fonderie-js/adapter-koa` | Koa — onion wrap-around `mount()`, `bridge()`, `adapt()`, pre-adapted guards | 18 |
| `@fonderie-js/adapter-hono` | Hono — `mount()`, `bridge()`, `adapt()`, `notFound` infra fallback, pre-adapted guards | 11 |
