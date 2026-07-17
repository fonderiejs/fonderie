# Multi-module + lifecycle experiment — design (SIGNED OFF 2026-07-16)

> Decisions locked 2026-07-16: model claude-fable-5; no hard budget cap but a
> stop-and-reassess checkpoint if the first A/B sequence pair exceeds $25
> combined; stage 4 = security-review maintenance task; disposable docker
> Postgres per sequence for both conditions. Re-drafted 2026-07-16; the
> original design was lost with an interrupted session.

## Question

Rounds 1–3 (`../token-cost-2026-07/`) measured one module (auth), greenfield
only. The article's cost claim needs to survive two harder conditions:

1. **Multi-module** — does the skill's context overhead amortize across
   modules now that signatures are split per-package (fonderie-js `ac4f40c`),
   and does package leverage compound as the app grows?
2. **Lifecycle** — greenfield build cost is only half the story. When an agent
   returns to a *growing* codebase in later sessions, the from-scratch
   condition must re-read its own ~600-line auth every time; the Fonderie
   condition carries a thin app plus ~1.5K tokens of per-package signatures.
   Hypothesis: cumulative cost diverges in Fonderie's favor as stages accrue.

**Primary outcome:** cumulative cost (USD, as reported by Claude Code) across
a 4-stage build-and-evolve sequence, per condition.

## Conditions

Identical to rounds 1–2 except both skeletons now get a database (see below).

- **A (scratch):** `skeleton-a` — plain TypeScript/Express, no auth deps.
- **B (fonderie):** `skeleton-b` — same app + `@fonderie/core` in
  package.json + the **post-split** Fonderie skill (`ac4f40c` or later) copied
  into `.claude/skills/fonderie/`. Prompts never name Fonderie; discovery is
  the skill's job. All packages resolve from npm (auth 1.2.0, workspaces
  1.1.0, permissions 1.0.1, rate-limit 0.1.0, store 0.1.1, core 0.1.3).

**New vs rounds 1–3 — provisioned Postgres.** Each sequence gets a fresh
disposable Postgres and a `DATABASE_URL` line in the skeleton README and
`.env`. Implementation note: this machine has no Docker, so the cluster is
provisioned with the `embedded-postgres` npm package (real Postgres binaries,
per-sequence data dir, torn down after) — same isolation guarantee as the
signed-off docker approach; disclosed here. Rationale: workspaces/roles state needs real persistence;
letting each condition improvise storage (rounds 1–3) added noise to LOC and
security scoring, and Fonderie's store targets Postgres. Applied identically
to both conditions, disclosed in the article's methodology.

## Lifecycle protocol

A **sequence** = 4 stages on one working tree. Each stage is a fresh headless
session (`claude -p`, fresh context — mirrors real multi-day use); the only
carryover is the code the previous stage left behind. Snapshot the tree
(git commit inside the run dir) after every stage for scoring, regression
checks, and stage-level reruns.

Stage prompts (expert-style fixed specs, like rounds 1–2 — the naive-prompt
question was already answered by round 3):

- **S1 — build: auth.** The round-1/2 prompt **verbatim** (comparability
  anchor): signup, login, logout, server-side sessions, password reset by
  email, input validation, rate limiting on login. Production quality.
- **S2 — extend: workspaces.** "Add workspaces (organizations) to this app:
  create a workspace; invite members by email with expiring, single-use
  invitations; accept or reject an invitation; list members. A user can
  belong to multiple workspaces. Production quality."
- **S3 — extend: roles & permissions.** "Add roles and permissions: each
  workspace has ADMIN and GUEST system roles; members can hold multiple
  roles; permission checks enforced on every workspace route; endpoints to
  create a custom role, assign and remove a member's roles, and set a role's
  permissions. Production quality."
- **S4 — lifecycle change (maintenance, forces touching existing code).**
  "Security review findings for this app: password reset requests and
  invitation acceptance are not rate limited; authentication and role
  changes are not audited. Fix both: extend rate limiting to those
  endpoints, and add an audit log recording login, logout, password reset,
  and every role grant/removal. Production quality."

## Runs

- **3 sequences per condition** (6 sequences, 24 sessions), alternating
  A/B, one at a time.
- Model: claude-fable-5 (matches rounds 1–2; see open decisions). Claude Code
  version pinned in README at run time.
- Truncation rule (same spirit as before): a stage cut by a usage limit is
  discarded and rerun from the pre-stage snapshot in a fresh session;
  disclosed in results.csv, never averaged.

## Measurements

Per stage AND cumulative per sequence: `cost_usd`, turns, wall seconds,
output tokens, cache read/write, LOC added and modified (`git diff --stat`
against the pre-stage snapshot), typecheck clean.

**Scorecard (20 points, pass/fail, scored on the final tree):**
- The existing 12-point auth checklist, unchanged.
- 8 new workspace/RBAC points: invitation tokens single-use + expiring;
  invitation flow doesn't leak account existence; permission check present on
  every workspace route (spot-check matrix); GUEST cannot perform mutations;
  multi-role aggregation correct (ADMIN+GUEST member has ADMIN rights);
  workspace isolation (member of W1 cannot read W2 data); role management
  requires ADMIN; all SQL parameterized.

**Regression check:** fixed smoke scripts (auth flow, workspace+invite flow,
permission-denial flow) run after every stage; a stage that breaks a prior
stage's smoke test is recorded as a regression for that condition.

## Certainty gate (pre-registered — P4 applies it mechanically)

The article gets rewritten as a single confident cost-claim proof **only if
all three hold**:

1. Fonderie cumulative cost < scratch in **3/3** sequences, mean saving ≥ 25%.
2. Fonderie total scorecard ≥ scratch in **3/3** sequences.
3. No regression in any Fonderie sequence that scratch avoided.

Anything else → no-go: the article keeps its honest before/after framing and
this experiment is reported as another round.

## Budget

Round 1–2 expert-prompt sessions cost $2.5–5.8 each; stages here are
comparable or smaller. Estimate **$1.5–3 per stage → $6–12 per sequence →
$36–72 total**. Proposed hard cap **$80**; checkpoint after the first A/B
sequence pair — stop and reassess if the pair exceeds $25 combined.

## Harness (to build in P3)

```
multi-module-2026-07/
  DESIGN.md            this file
  run-stage.sh         cond + seq + stage: restores/reuses seq dir, starts
                       fresh Postgres, runs one headless session, snapshots,
                       records JSON + meta
  prompts/stage{1..4}.txt
  skeleton-a/ skeleton-b/   copied from ../token-cost-2026-07, + .env/README
                            DATABASE_URL line; b gets the post-ac4f40c skill
  smoke/               fixed regression scripts (bash + curl)
  checklist.md         the 20 points, verbatim, scored by hand per sequence
  results.csv          per-stage rows + cumulative columns, aborted runs disclosed
```

## Open decisions (need sign-off)

1. **Model** — claude-fable-5 (continuity with rounds 1–2) vs claude-opus-4-8
   (continuity with round 3, cheaper default-model story). Recommendation:
   fable-5; the confident-proof article anchors on rounds 1–2.
2. **Budget cap** — $80 hard cap with a $25 first-pair checkpoint OK?
3. **Stage-4 content** — the security-review maintenance task above, or a
   feature-change task instead (e.g. multi-role support if S3 excludes it)?
4. **Postgres provisioning** — docker on this machine acceptable for runs?
