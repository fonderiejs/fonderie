# Phase 2.5 — R1 measurement findings

**Milestone outcome: infrastructure validated; behavioral hypothesis refined.**
Not an R1 success or failure — the question itself changed. See § Conclusion.
(The raw generated table lives in `report.txt`; this is the interpretation.)

Scope: R1a (retrieval *decision*), wiring-only prompt, so the signal is *when
does the model consult the brain*, not whether it can build an app. Sample is
**underpowered (n=7)** — the batch was stopped early (≈6 runs/login cap). Read
the tiers below, not the point estimates.

## Data (n=7, claude-opus-4-8, wiring-only, matched skeleton)

| Metric | Arm A (tool only) | Arm C (hook) |
| --- | ---: | ---: |
| Sessions | 4 | 3 |
| Retrieval attempted | 4/4 | 3/3 |
| Retrieval succeeded | 4/4 | 3/3 |
| Retrieval before code | 2/4 | 2/3 |
| 95% CI (Wilson) | 15%–85% | 21%–94% |
| Wrong retrieval | 1 | 0 |
| Missed retrieval | 0/4 | 1/3 |
| Unnecessary (avg) | 1.00 | 3.00 |
| Median latency | 0.17 ms | 0.18 ms |
| Version-skew failures (post-fix) | 0 | 0 |
| First action | Bash ×4 | Bash ×2, ToolSearch ×1 |

Per-category (arm A): auth 2/2 before-code, billing 0/2. Both arm-A misses were
the billing tasks — the model queried the brain, but only after starting on code.

## Three tiers of confidence

### High confidence (robust; retire these as open risks)
- MCP `brain_query`/`node`/`recipe` is operational; retrieval **succeeds when
  invoked** (7/7 attempted, 7/7 succeeded).
- Lookup latency is **negligible** (median <0.2 ms).
- The **version-skew guard works** and, once the skeleton matched the brain,
  produced 0 false failures.
- The **measurement harness is trustworthy** — exercised by real runs and
  hardened through five instrumentation fixes (below).

### Medium confidence (directional; consistent even at n=7)
- Models **often retrieve eventually** — every arm-A session attempted a query.
- **In this benchmark, the dominant observed first action was local inspection
  via Bash** (6/7 sessions). A direct observation under the tested conditions —
  *not* a claimed general property of coding models.

### Low confidence (do not quote as results)
- The exact voluntary retrieval rate.
- The exact retrieval-before-code percentage.
- Any A-vs-C difference (CIs overlap heavily at this n).

## The version-skew finding (highest-value engineering insight)

With a stale test skeleton (`@fonderie/core` 0.1.2 vs the brain's 0.1.4), the R3
mismatch banner fired on every run. After matching the versions, arm C's
retrieval-before-code went from **0/3 → 2/3** across the two batches. Small n,
but the direction is striking and the mechanism is plausible: **a "this brain
may not match your install" warning appears to reduce the model's trust in the
brain and push it toward reading source.**

Implication: **brain freshness is not merely a correctness concern — it is a
behavioral dependency.** In Phase 3 this makes freshness a first-class
operational feature, not a maintenance chore: freshness monitoring, automatic
regeneration, version-compatibility guarantees, and install-time UX.

## How R1 evolved

- **Before:** "Will the model voluntarily use the brain?" → framed as binary
  (tool / no tool).
- **After:** it *does* use it voluntarily, but *not reliably first*. The live
  question is **retrieval timing** — what intervention increases
  retrieval-*before*-code. That is a causal question, and it is what the next
  experiment must answer.

## Harness fixes surfaced by real runs (none reached the reported numbers)

1. **stdin drain** — `claude -p` consumed the batch run-list; only 1 task ran.
   Fixed with `</dev/null` + an FD-3 feed.
2. **transcript source** — `--output-format json` has no tool history; score off
   the on-disk `~/.claude/projects` transcript.
3. **Bash-written code** — models write app files via Bash heredocs, not
   Write/Edit; the edit-detector had to cover Bash.
4. **metric scoping** — `unnecessary` and `wrong` were counting
   `brain_node`/`brain_recipe` drill-downs; scoped to `brain_query` only
   (wrong 14→1, 12→0).
5. **version-skew confounder** — stale skeleton; refreshed, 6 skewed runs
   discarded (archived, disclosed, never scored).

Plus a resumable batch (stop-on-limit + skip-done) so a session-limit
truncation keeps partial progress instead of burning the rest as 2 s failures.

## Conclusion (milestone close)

Phase 2.5 demonstrates that semantic retrieval is reliable, low-latency, and
voluntarily discoverable under the tested conditions. The remaining uncertainty
concerns **retrieval timing, not retrieval capability**. Preliminary evidence
suggests models frequently begin with local workspace exploration before
consulting semantic retrieval. **The next experiment should evaluate
interventions that increase retrieval-before-code** — starting with Arm B
(tool + brain-first stub) as an intervention measuring Δ against this baseline —
**rather than collecting additional baseline Arm-A sessions.**

Program progression:
- **Phase 2:** Can the brain serve knowledge reliably? → ✓
- **Phase 2.5:** Does the model discover and use it? → ✓ eventually, not reliably first
- **Next:** What reliably causes the model to use it *first*? → open (Arm B)
