# Portfolio Roadmap — coherence & legibility

What Fonderie is, why the 71 packages still cohere, and the concrete work to
make that coherence legible — to ourselves, to the brain (the LLM that is our
real client), and to users.

Opened: 2026-09-11, from the portfolio audit ("Who Is Fonderie?"). This is a
**legibility** roadmap, not a rewrite: almost nothing here gets deleted. The
finding was that the mission held and even sharpened, but the story outgrew its
telling — and if we can't explain the stack, neither can the brain or the user.

Companion strategy docs: `MONETIZATION` (where it makes money), `BRAIN.md` (how
the brain is kept fresh), `FRONTEND-PARITY.md` (the mirror families).

---

## 0. Identity — the anchor every decision hangs on

**Fonderie is the self-hosted SaaS backend, assembled by AI.**

The dozen application-layer vendors a SaaS wires together on day one — Auth0,
Stripe-plus-glue, WorkOS, LaunchDarkly, Twilio/SendGrid, Svix, a starter CRM,
an S3 bucket for avatars — collapsed into typed npm bricks that run **in your
process, against your Postgres**. No vendor, no per-seat tax, no data leaving.

Two properties make this ours rather than a re-wrap of what exists:

1. **Self-hosted by construction.** "Fonderie never sits in the request path"
   — there is nothing to rent because every brick is `npm install` +
   in-process `.register()`.
2. **AI-legible by design.** The CLI, the skill, and the brain exist so an
   *agent* can assemble the stack. "Powered by AI" means composable-by-AI, not
   that the bricks think.

### We are not AWS

AWS rents raw infrastructure (compute, network, disks, managed engines). We
sit one layer up — the application backend between raw infra and the product.
This is a line, not a nuance: **hold at application-plumbing, never
infrastructure.** The moment a brick tries to be infrastructure instead of
plumbing for a SaaS, it leaves our realm and we trade the rare thing
(coherence) for a fight we can't win (S3, Kafka, Datadog on price/scale).

### The two edges to watch

Neither has crossed the line; both feel the "AWS gravity":

- **`storage`** — content-agnostic object storage (Postgres/disk/S3). Keep it
  scoped as *the backend that serves the bricks* (media, future archives), not
  a general-purpose bucket product. Litmus: does a change serve a Fonderie
  brick, or does it chase S3 parity?
- **Telemetry / analytics track** — keep scoped to consent-safe, PII-safe
  *product* analytics riding the events bus. Not APM, not tracing, not a
  Datadog competitor.

**Decision needed (owner: founder):** commit to the "self-hosted SaaS backend,
assembled by AI" identity so the two edges can be explicitly reined in. Every
workstream below assumes this identity.

---

## The portfolio in five tiers

71 packages are not 71 ideas. Stated as tiers, the sprawl reads as structure —
and this table is itself the first artifact the brain and users need.

| Tier | Packages | Role |
| --- | --- | --- |
| **Foundation** | `core` · `store` · `events` · `logger` | Router/modules, DB abstraction, the bus, structured logs. |
| **Adapters** | `adapter-express` · `-hono` · `-koa` | Mount bricks in the framework the user already chose. |
| **Capability bricks** | `auth` · `permissions` · `workspaces` · `billing` · `courier` · `config` · `audit` · `webhooks` · `customers` · `rate-limit` · `media` · `storage` | The vendor-replacements. The product. |
| **Client & tooling** | `client` · `cli` · `create-fonderie-app` | Typed SDK, agent-teaching CLI, scaffold. |
| **Frontend mirrors (~45)** | `{react,vue,react-native}-{brick}` (+ `-screens`) | One pattern — hooks + optional screens, per brick, per framework. |

---

## Workstreams

Ordered by leverage. P1 is the highest-return single change we can make.

### P1 — Write the identity + taxonomy into the brain  ·  `must`

**Problem.** An agent composing a stack sees 71 package descriptions and no
map: no realm statement, no tiers, no distinction between the confusable
bricks. There was once a `FONDERIE.md` "full architecture spec", but it was a
positioning/strategy memo, **deliberately removed from the public repo and
gitignored** as an internal working file (commit `1428caec`, 2026-08-21).
Reusing that name would reverse that decision — so the public map needs a new
home.

**Deliverable.**
- **`docs/ARCHITECTURE.md`** (done in this roadmap's first pass): the identity
  (§0), the five-tier map, the dependency direction, the frontend-mirror
  pattern, the party model (P2), the observability split (P5), stability tiers
  (P4 interim), and the confusable-set reference. A public *technical map* —
  distinct in kind from the internal `FONDERIE.md` positioning memo.
- Wire it into the hand-maintained brain surface: a pointer from `SKILL.md`
  (done). Follow-up: fold the party-model invariant into
  `brain-knowledge.json` (curated) and regenerate `brain.json`, per
  `BRAIN.md`'s generated-vs-curated split. Never hand-edit generated files.

**Acceptance.** `docs/ARCHITECTURE.md` exists and `SKILL.md` links it; a cold
agent can state Fonderie's realm and place any brick in a tier from the brain
alone; the `docs:signatures` and `docs:brain` CI gates stay green (this doc +
the `SKILL.md` pointer touch neither generated file).

### P2 — Name the party model once  ·  `must`

**Problem.** `user` (auth) vs `member` (workspaces) vs `customer` (customers)
is the confusion most likely to produce wrong code — from us *or* the brain.

**Deliverable.** One canonical statement, with a diagram, in `docs/ARCHITECTURE.md` and
as an invariant in `brain-knowledge.json`:
- **user** = the authenticated principal (`fonderie_users`, owned by `auth`).
- **member** = a user's belonging to a workspace/team (`workspaces`).
- **customer** = a record of someone *the user's business* serves — a CRM
  entity (`customers`), workspace-scoped, never a login.

**Acceptance.** The three terms are defined in exactly one place; the brain
carries the invariant; no doc uses them interchangeably.

### P3 — Frame the ~45 mirrors as one pattern  ·  `should`

**Problem.** react/vue/react-native × {hooks, screens} × 8 bricks is a
*pattern*, but nothing says so, so it reads as overwhelming surface — the
single biggest "we look confusing" source.

**Deliverable.** State the rule once in `SKILL.md`/`docs/ARCHITECTURE.md`: *"Every brick
with a UI ships `{framework}-{brick}` hooks + optional `{framework}-{brick}-screens`,
across react / vue / react-native; RN often re-exports React."* Cross-link the
existing `FRONTEND-PARITY.md` contract. No packages merged.

**Acceptance.** The frontend families are described by one rule an agent/user
can restate; the mirror count stops reading as 45 separate decisions.

### P4 — Publish stability tiers  ·  `should`

**Problem.** The 0.x-vs-9.x version spread (`media` 0.2, `storage` 0.1 beside
`billing` 9.0) is real maturity signal left implicit.

**Deliverable.** A `stable | beta | experimental` marker per brick — surfaced
in `docs/ARCHITECTURE.md` and machine-readable in the brain (so the agent won't lean on
an experimental brick as if it were load-bearing). Pick the source of truth
(a `fonderie.stability` field in each `package.json`, read by the brain build,
is the cheapest durable option).

**Acceptance.** Every capability brick has a tier; the brain exposes it; the
generator enforces presence so a new brick can't ship untiered.

### P5 — Unify the observability story  ·  `should`

**Problem.** `events` / `audit` / `logger` (+ the telemetry roadmap) are three
"what happened" packages with real blur.

**Deliverable.** One "observe your app" narrative that states the split:
**events = the bus (integration), audit = a human-readable read-model over
events (compliance), logger = operational telemetry (ops).** Place it in
`docs/ARCHITECTURE.md`; make explicit that `audit` is a *view over* `events`, not a
rival store.

**Acceptance.** The three appear under one story with the write/curate/observe
distinction stated; no reader would reach for `audit` expecting a second event
store.

### P6 — Approve `@fonderie/risk` with a hard boundary  ·  `should`

**Problem / opportunity.** The trial-abuse work needed a signal-scoring engine;
its webhook *enforcement* failed adversarial review three times. The lesson:
every failure came from a brick performing a side effect.

**Deliverable.** Ship `@fonderie/risk` as a **generic signal → meaning →
decision engine** (subjects: `trial.start`, `auth.login`, `auth.register`,
`promo.redeem`, …) with one iron boundary: **decide, never enforce.** The brick
is pure/synchronous — collect signals, score, return a verdict with reasons.
The app owns every side effect (deny / challenge / MFA / cancel / alert) and
the concurrency and idempotency that come with it.
- One generic `risk_events` hashed-identity store; the PII firewall as a
  first-class, reused property.
- Rulesets as data (weights + windows + thresholds), tunable without deploys.
- `ISignalProvider` seam for vendor adapters (Radar/MaxMind/Fingerprint/Sift)
  later.
- Built by **extraction** from the proven trial code, not speculation.

**Consequence.** The trial-only durable-enforcement PR (`#6`,
`fix/trial-risk-durable-enforcement`) is **superseded** — close it unmerged
rather than patch further; extract the sound detection/scoring into the brick;
leave post-checkout trial revocation as an explicit, separately-designed app
concern (the gate signals + detection already stop the high-volume abuse).

**Acceptance.** A `@fonderie/risk` package exists with `assess()`/`record()`
and no external-effect call anywhere in it; LeadEasyGen consumes it for
`trial.start` and its app-owned `trial_signals` + webhook-cancel are removed;
the live Stripe test-mode pass runs.

---

## The confusable sets (fold into docs/ARCHITECTURE.md, resolved by P1/P2/P5)

| Set | The distinction | Verdict |
| --- | --- | --- |
| `auth` / `workspaces` / `customers` | user / member / customer — see P2 | clarify |
| `events` / `audit` / `logger` | bus / read-model / ops telemetry — see P5 | clarify |
| `storage` / `media` | content-agnostic bytes / image-domain policy (clean layering) | keep, label |
| `events` / `webhooks` | internal bus / signed external fan-out | keep |
| `config` secrets | **operator**-level (one app key); do **not** overload with **tenant**-level secrets (e.g. a bot platform's per-user exchange keys — that is a separate, future concern) | watch |
| `rate-limit` / `risk` | mechanical token bucket / probabilistic scoring; risk *consumes* rate-limit, must not reinvent it | watch |

---

## Sequencing

1. **Founder decision** on the §0 identity (unblocks the two-edges posture).
2. **P1 + P2 together** — `docs/ARCHITECTURE.md` with the tier map and party model, wired
   into the brain. Highest leverage; everything else references it.
3. **P3 + P4 + P5** — the remaining legibility passes (mirror pattern,
   stability tiers, observability story). Independent; parallelizable.
4. **P6** — `@fonderie/risk` extraction, in its own track (largest effort);
   close PR #6 first.

**Not on this roadmap: deletion.** No package is unjustified enough to cut. We
clean up by *explaining* — one map, one party model, one mirror pattern, honest
tiers, one observability story. That is what turns 71 packages from "what is
all this?" into "oh — it's the stack."
