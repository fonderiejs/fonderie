# Fonderie "Operated" — The Operating Manual

A strategic blueprint for Fonderie's business, following the YC "Full-Stack
AI" thesis: **the money is in the work, not the tool.** The MIT bricks are
the lead engine; the operated service at payroll-anchored pricing is the
business.

**Aligned with:** `organization/VENTURE-RESHAPE.md` v3 (Operated-first —
Cloud is internal tooling, not a revenue product). This document is the
operating manual referenced by its §10 change list.

---

## 1. The Value Shift & Anchoring

### What "the work" actually is

Fonderie's self-serve user doesn't buy auth — they buy the *obligation* to
correctly assemble, secure, deploy, and maintain a SaaS backend: wiring
bricks, configuring Stripe and email providers, hardening JWT secrets,
running migrations, triaging dependency advisories, keeping the audit trail
intact, staying on-call. The brick is free (MIT). The work is everything
around it.

### Who the customer would otherwise hire

Realistic alternatives for the ICP (funded or bootstrapped founder building
an AI-built SaaS):

| Alternative | Market cost (US, 2025–26 ballpark) | Time to value |
|---|---|---|
| Senior backend engineer (auth/billing/infra) | $160k–$190k base, ~$220k–$240k fully loaded | 3–6 months to recruit + ramp |
| Fractional DevOps/SRE (0.25 FTE) | ~$40k–$60k/yr | Ongoing |
| Security review / penetration pass | $15k–$40k per engagement | Point-in-time only |
| Dev shop MVP build | $40k–$90k one-time | 3–6 months, then unmaintained |

The honest anchor: **$200k+/yr and a hiring cycle**, or a dev shop that
hands you code and disappears.

### The anchor math

Price Operated at **$3,500/mo ($42k/yr)** — roughly **15–20% of one loaded
senior engineer**, and structurally better than a dev shop because it is
*operated*, not delivered-and-dropped. There is no self-serve hosted tier to
compare against — deliberately. The buyer is not comparing software
subscriptions; they are comparing payroll lines.

The sales page should never put Operated next to the free tier as "more
features." It should sit next to a job posting:

> *"Senior Backend Engineer: $18k/mo. Fonderie Operated: $3.5k/mo. Ships
> this month, never quits, audited by construction."*

The kill-shot proof point is already in the README: from-scratch AI builds
shipped hard-coded secrets in **2 of 3** runs; Fonderie builds shipped zero,
in roughly **⅓ the code**. That is not a feature — that is the liability
story that makes a founder pay 10x. (Caveat per `YC_Security_Experiment.md`:
report observed rates, never as fixed numbers — see the honesty rules in
VENTURE-RESHAPE §5.)

---

## 2. The Re-Architected Offer

### Self-Serve (exists today, free/MIT)

The customer (or their AI assistant) installs bricks, composes
`buildFonderie()`, configures providers, deploys to their infra, runs CI,
reads `SECURITY.md`, applies upgrades, monitors, and debugs. They own
everything — including every mistake.

### "Fonderie Operated" inherits completely

- Architecture & brick selection (auth, workspaces, billing, permissions,
  courier, audit, risk, webhooks — chosen for their product)
- Provider configuration (Stripe, email/SMS, storage, Redis)
- Deployment & hosting (their cloud account, or our operator fleet's
  infrastructure)
- Security posture: secret management, rate-limit policy, RBAC matrix
  design, audit trail integrity
- Upgrades, dependency advisories, migrations — forever
- Monitoring, alerting, incident response
- New feature/backend capability requests via a monthly request queue
- **Frontend delivery (Operated Plus):** prebuilt React/Vue/React Native
  screens — login, billing, workspaces, customers, audit, admin — wired to
  the client's backend on the same contracts

### What the customer receives without ever logging in

1. **A live API base URL** + the `@fonderie/client` SDK wired to it — their
   frontend (or their AI assistant) just consumes it.
2. **A monthly Operated Report** (this *is* the product): uptime, request
   volume, security events blocked, upgrades applied, audit-log summary,
   next month's queued work.
3. **A Slack/email channel** that behaves like a senior engineer: "add team
   invitations" → shipped, with a diff summary.
4. **Escrow guarantee:** full export of code, data, and config on 30 days'
   notice. Counterintuitive but critical — it removes lock-in fear, the #1
   objection to DFY, and most clients never exercise it.

The dashboard does not disappear — it becomes *internal tooling for the ops
team* (`@fonderie/admin`, `/_admin`, and the audit screens are already built
as operator surfaces in this repo). Per VENTURE-RESHAPE v3, this internal
tooling is what "Cloud" is: a cost-side asset that lets one operator carry
15–20 clients — not a product on the pricing page.

---

## 3. The Hybrid Margin Math

### Tier ladder (canonical — matches VENTURE-RESHAPE v3 §6)

| Tier | Price | What it is | Gross margin |
|---|---|---|---|
| Build (Open Source) | $0 (MIT) | The bricks + skill. Lead engine, not a product | — |
| **Operated** | **$3,500/mo + $7,500 one-time setup**, or **$9,900/quarter prepaid** | Build + operate + monthly report | ~80–85% |
| Operated Plus | $6,500/mo | Adds frontend screens (React/Vue/RN bricks), 48h SLA, weekly cadence | ~75% |
| Enterprise | From $10K/mo | Everything in Operated, plus dedicated infra, on-prem support, compliance evidence, contractual SLA | ~70% |

**The on-ramp:** the existing $499 "48-hour setup" becomes a paid pilot,
**credited against the first Operated quarter.** It is the same motion at
pilot scale — not a competing offer (resolves the $499 vs $7,500
contradiction from `AUDIT-2026-10-DFY.md` finding #3).

### Packaging recommendation

Sell Operated as a **quarterly engagement ($9,900/qtr)** rather than
monthly. It matches how founders budget for contractors, reduces
churn-window frequency 4x, and the setup fee ($7.5k) can be waived on annual
prepay — the cash-flow accelerator.

### Labor leverage

A normal agency PM handles 4–6 clients because every client's stack is
bespoke. Fonderie operators run a **standardized fleet**: every client is
the same brick composition, the same `create-fonderie-app` scaffold, the
same CI gates, the same admin surface.

Per client per month:

- ~2h proactive maintenance (upgrades, advisories, report generation —
  AI-drafted, human-approved)
- ~4–6h request-queue work

Total ≈ **6–8h/client/month** → **one operator (160h/mo) handles 15–20
clients.**

### Per-operator P&L at 15 clients

- Revenue: 15 × $3,500 = **$52.5k MRR**
- Cost: ~$11k loaded operator salary + ~$3k infra/AI tokens ≈ $14k
- **~73% gross margin per pod**, climbing toward 80% as the request queue
  gets more AI-automated

Two pods (40 clients) = **$1.68M ARR with ~5 FTEs.** Software margins,
agency pricing.

### Feasibility under the current constraint

The founder runs ~15 hrs/week alongside a full-time job. Operated is the
only tier deliverable inside that constraint, because onboarding is capped
at **2 concurrent clients** and steady-state load is 6–8h/client/month. The
written full-time transition trigger (VENTURE-RESHAPE §8): **3 paying
Operated clients ≈ $10.5k MRR.** The first operator hire happens only when
Operated revenue covers it (>12 clients on the founder).

---

## 4. Operational Workflow (Human-in-the-Loop)

### Phase 1 — Onboarding (Days 1–10, fixed scope)

1. **Intake interview (human, 60 min):** product description, user model,
   billing model, compliance needs. Output is a one-page spec — no
   open-ended discovery.
2. **AI drafts the architecture:** the Fonderie skill/CLI
   (`fonderie query`) maps the spec to a brick composition and config. AI
   also drafts the RBAC matrix and data model.
3. **Human architect review (the critical gate, ~2h):** checks what AI
   systematically gets wrong — permission boundaries between workspace
   roles, billing webhook edge cases (mid-cycle upgrades, failed payments),
   secret handling, and whether the data model survives the client's next
   two features. **AI never ships past this gate unreviewed.**
4. **Scaffold & build:** `create-fonderie-app` + AI wiring (route mapping,
   migrations, test scaffolding, courier templates) — the measured
   ~⅓-code advantage is the cost advantage here.
5. **CI as automated QA:** the repo's own gates run per client — lint,
   `npm audit --audit-level=high`, typecheck, real-Postgres suites,
   signature freshness. CI failing = nothing deploys. The quality floor is
   free.
6. **Human final review:** business logic only (the bricks are already
   audited — never re-review auth internals). Client UAT against a staging
   URL. Go-live.

### Phase 2 — Steady-state operations (monthly loop per client)

**AI does automatically:**

- Dependency advisory triage and patch PRs
- Upgrade changelogs
- Uptime/incident summaries
- First draft of the monthly Operated Report
- Request-queue code for standard asks ("add webhooks," "add SSO")

**Human reviews (the 100% quality layer):**

- Every PR touching auth/billing/permissions config (fail-closed domains)
- Every migration against a production-shaped snapshot
- Every monthly report before it goes out (accuracy *and* tone — the report
  is the churn defense)
- Quarterly security posture review per client: secret rotation, RBAC
  drift, audit-log HMAC integrity verification

> **The rule: AI generates, CI gates, humans decide on anything that
> touches money, identity, or data deletion.**

**The automation byproduct rule:** every engagement must land at least one
automation in the operator tooling or one brick improvement. Revenue is the
point of the tier; automation is what lets the next 15 clients cost the
same as the first.

---

## 5. Risk & Churn Mitigation

### The "it's running smoothly, why do we pay?" problem

This is the existential DFY risk. Four counters:

1. **Make the work visible monthly.** The Operated Report is not a courtesy
   — it is the retention mechanism. Clients cancel services they can't see.
   Every report lists patches applied, threats rate-limited, upgrades
   shipped, incidents handled at 2am. Silence is churn; a report full of
   invisible disasters averted is renewal.
2. **Own the treadmill, not the build.** Node LTS rotations, Stripe API
   version bumps, npm advisories, breaking dependency upgrades —
   infrastructure never stops decaying. Position the fee as *insurance
   against entropy*, because that is literally what it is.
3. **Quarterly business reviews tied to their roadmap.** Each quarter ends
   with a planning call where the next quarter's request queue is loaded. A
   client with a full queue has pre-committed value — canceling means
   abandoning work already specified.
4. **Escrow as a trust weapon.** The export guarantee sounds like a churn
   enabler but functions as the opposite: it kills the sales objection, and
   switching means re-hiring the $200k engineer Fonderie replaced. Graceful
   exits are rare and cheap; fearful non-starts are expensive.

### Onboarding without a bottleneck

- **Fixed-scope intake.** The 60-minute interview + one-page spec is
  non-negotiable. Custom discovery is where DFY margins die.
- **Vertical templates.** The `examples/` folder is already the asset:
  `saas-starter` and `example-mobile-api` are pre-solved architectures. New
  client = fork the nearest template, don't design from zero. Target: 80%
  of onboarding is template, 20% is client-specific.
- **Cap concurrent onboardings at 2 per operator** and sell the waitlist
  ("next build slot opens on the 1st") — scarcity both protects quality and
  converts fence-sitters. Under the current 15 hr/week constraint this cap
  is what makes the whole tier deliverable.
- **Async-first comms:** one shared Slack channel, weekly Loom-format
  updates, no standing meetings. Meetings are the hidden ops cost that
  breaks the 15-clients-per-operator math.
- **Scope-creep contract terms:** the request queue has a defined monthly
  capacity (~4–6h); overflow rolls to next month or bills at a $250/hr
  change-request rate. Generous with judgment, ruthless with boundaries.

---

## Bottom Line

Fonderie's MIT bricks are the lead engine; Operated at $3,500/mo is the
business — not a tier on top of it. The standardization that makes Fonderie
good software — same bricks, same scaffold, same CI gates, same admin
surface — is exactly what makes it an unusually high-leverage operation:
**15–20 clients per operator instead of an agency's 4–6, at ~73–80% pod
margins.** The attach meters (courier relay, audit witness) and the
operator tooling compound underneath; a self-serve Cloud stays an option
funded by revenue, never a prerequisite for it.

### Next artifacts

- [ ] One-page Operated offer doc (public-facing)
- [ ] Monthly Operated Report template
- [ ] Operated service agreement (SLA, escrow, change-request terms)
- [ ] Intake questionnaire (the 60-minute interview script)
- [ ] Rewrite `offers/48-hour-setup.md` as the $499 pilot on-ramp (credited against quarter one)
