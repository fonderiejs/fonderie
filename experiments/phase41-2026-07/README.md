# Phase 4.1 — Retrieval Advantage Benchmark (harness)

Executes the benchmark **pre-registered in `BRAIN_PLAN.md` § Phase 4.1** —
thresholds and decision rule were locked before any data. This directory is
the harness + raw results; do not renegotiate the rule here.

## Question

Goal B: across a repeated-session workload on one growing app, is the
**Fonderie-knowledge overhead per session** of the compiled project brain
**≤ ⅓** of the fat-skill baseline, at equal quality (checklist ≥ 11/12)?
This is the amortization regime — the only one where "a fraction of the token
cost" is physically winnable (condition C measured why a single small task
is not: `../token-cost-2026-07/FINDINGS-condition-c.md`).

## Design

- **Workload** (`sessions.jsonl`): 4 sequential cold sessions on ONE growing
  app — (1) auth (the exact naive baseline prompt), (2) billing + plan-gating,
  (3) teams with email invites, (4) security pass (rate-limit reset/invites +
  audit). Mirrors the repo's real multi-module stage prompts.
- **Conditions** (identical session sequences):
  - `fat` — skeleton-b + fat skill dir (condition-B replica, brain artifacts
    stripped from the copy)
  - `pb` — skeleton-b + **compiled project brain as CLAUDE.md**, regenerated
    before every session from the workdir's installed packages (freshness by
    construction) + MCP brain server for discovery of not-yet-installed
    capabilities (one-shot `brain_query` with inline signatures)
  - `scratch` — skeleton-a, no Fonderie knowledge (quality-floor control)
- **N = 3 sequences per condition** (36 sessions), interleaved by condition,
  one model (`claude-opus-4-8`), resumable at session granularity with clean
  stop-on-limit; aborts disclosed, never averaged.
- **Metrics** recorded per session: usage (cache_read / cache_creation /
  input / output), cost, turns, wall, LOC, tsc, transcript, and (pb) the
  brain-call log. Primary analysis: Fonderie-knowledge overhead per session +
  cumulative cost at checklist-equal quality; secondary: whether pb's
  advantage GROWS with session index (the amortization signature).

## Run

```sh
./stage41.sh              # full batch, resumable — re-run after login resets
./run-sequence.sh pb 1    # one sequence manually
SEQ_MAX_SESSIONS=1 ./run-sequence.sh pb val   # cheap validation run
node analyze.mjs          # attribution + pre-registered decision (any time)
```

## Analysis (`analyze.mjs`)

Computes the pre-registered metric and emits the locked decision — never
renegotiates it. Two independent attribution methods:

- **Static-K** — resident-knowledge tokens (`k_tokens`, archived per session:
  pb = its CLAUDE.md, fat = the loaded skill dir, scratch = 0) × turns. The
  pb/fat *ratio* is pricing-independent.
- **Empirical** — `cache_read(cond) − cache_read(scratch)`, the differential
  vs the zero-knowledge control.

Guardrails: **no verdict** unless N ≥ 3 sequences per condition *and* quality is
scored *and* fat+pb+scratch are all present; a missing-K condition reports
UNAVAILABLE, never a zero that could masquerade as a win; a verdict is trusted
only when both methods agree. Everything below the raw audit table degrades to
INSUFFICIENT rather than guessing.

## Decision rule (from the pre-registration — locked)

- pb cumulative Fonderie-overhead **≤ ⅓** of fat → Goal B met; compiler ships
  as the `init` default; the "fraction" claim is earned.
- **⅓–1×** → parity-plus; retire the "fraction" headline.
- **≥ 1×** → kill rule: cost thesis dies; product claim reverts to measured
  correctness density.

## Status

- [x] Harness (run-sequence.sh, stage41.sh, sessions.jsonl)
- [x] Per-session K archival (k_tokens in meta + CLAUDE.md copy) — attribution input
- [x] Analysis harness (`analyze.mjs`) — dual-method, guardrailed, decision rule
- [x] Quality tooling (`CHECKLISTS.md` 4 rubrics + `score.mjs`; floor enforced)
- [x] Pre-flight checklist (`BEFORE_WE_START.md`); install-path confirmed (npm)
- [ ] pb-condition validation session (1 paid session + free regen check)
- [ ] 2-session pilot (1 pb + 1 fat, session 1) → `analyze.mjs` for early signal
- [ ] Full batch (36 sessions, ~$30–60, several login cycles)
- [ ] Checklist scoring (manual, ASVS-anchored — per R4 discipline)
- [ ] Analysis + decision per the pre-registered rule

> Note: existing `fat-1`/`pb-val` results predate K archival, so `analyze.mjs`
> reports their pb/fat ratio as UNAVAILABLE (K unmeasured, not zero). Sessions
> run with the patched harness carry `k_tokens` and are fully analyzable.
