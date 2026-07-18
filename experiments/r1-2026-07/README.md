# Phase 2.5 — R1 measurement milestone

Answers the one question the whole Brain approach depends on: **will models use
`brain_query` without being explicitly told?** (BRAIN_PLAN.md risk R1.) Building
the MCP server proved we *can* expose the brain; this proves whether the model
*chooses* it. Explicit go/no-go gate before any Phase 3 install-pipeline work.

## Design — three arms isolate the question

The hook and the measurement are in tension: if the hook forces redirection,
"did it call brain_query?" is trivially yes. So we separate **voluntary** use
from **enforced** use across three arms, each a cold headless Claude Code
session with the brain MCP server registered:

| Arm | Setup | Question it answers |
| --- | --- | --- |
| **a** tool-only | brain MCP registered; no stub, no hook | **Core R1**: does the model call the brain on its own? |
| **b** tool+stub | + CLAUDE.md brain-first instruction | Does the instruction lift voluntary use? |
| **c** hook | + PreToolUse hook redirecting `@fonderie` reads → brain | Deterministic floor: does enforcement work, at what cost? |

## Instrumentation (all validated on synthetic + 1 real session, $ ~0.40)

- **brain-serve.mjs** logs every MCP call to `FONDERIE_BRAIN_LOG` (JSONL:
  tool, arg, `top` packages returned, latency_ms, matched, version_skew).
- **brain-hook.mjs** logs every Fonderie read opportunity to
  `FONDERIE_HOOK_LOG` (the miss-detector).
- **run.sh** runs one isolated cold session per arm and captures the real
  on-disk transcript (the `--output-format json` summary has NO tool history —
  found on run 1; the transcript JSONL under `~/.claude/projects/` is the
  source of truth).
- **score.mjs** fuses transcript + logs into the retrieval-value metrics, and
  `--aggregate` rolls up per arm and applies the hard gate.

## Retrieval-value metrics (per the milestone spec)

| Metric | Meaning |
| --- | --- |
| attempted | model issued any brain_query |
| succeeded | a brain_query returned a match |
| before_code | brain_query fired before the first Fonderie read/edit |
| wrong_retrievals | matched query whose returned packages miss all expected |
| missed_retrieval | reached for @fonderie source/edit (or hook intercept) with no brain_query |
| unnecessary_retrievals | brain_query calls beyond the expected package count |
| median_latency_ms | lookup UX cost |
| version_skew_fail | served a mismatched brain |

`before_code` is the automatic-retrieval signal; `changed_answer_proxy` =
before_code ∧ succeeded (retrieval that plausibly shaped the output).

## Hard gate (go/no-go for Phase 3)

- auto_retrieval_rate ≥ 0.90
- avg_unnecessary_per_session ≤ 1
- median_latency_ms < 200
- version_skew_failures = 0
- (regression check) checklist quality not below the round 0-baseline

## Tasks

`tasks.jsonl` — 10 tasks across auth / billing / workspaces / permissions /
courier / webhooks / security / compound, each with expected packages.

## Early signal (N=1, NOT the result)

First real arm-a session (`add user accounts`): **0 brain_query calls** — the
model read `@fonderie` source and wrote the app via Bash heredocs instead.
One data point, but it's the R1 risk showing up immediately, and it's exactly
why arms b/c exist. Not averaged, not a conclusion.

## Stage 1 (DONE — closed at n=7, underpowered by choice)

Ran arms a (tool-only) & c (hook), wiring-only prompt, matched skeleton.
Outcome: milestone closed, hypothesis refined (see FINDINGS.md). This is the
frozen methodology for the milestone — Phase 2.6 reuses the same harness,
scorer, tasks, and pre-registration discipline.

## Next milestone → Phase 2.6 — Retrieval Intervention (pre-registered)

Not "Stage 2" and not more measurement — an **intervention experiment**. R1
evolved from "does the model use the brain?" (answered: yes, eventually) to
"what reliably shifts retrieval from *eventually* to *before code*?"

**Primary output — a single effect size, not a pass/fail:**

```
Δ = P(retrieval before code | tool + stub)   [arm B]
  − P(retrieval before code | tool only)     [arm A baseline, this milestone]
```

- **Arm B** = tool + brain-first CLAUDE.md stub (already implemented in run.sh).
- **Interpretation (locked before data):** large positive Δ → a lightweight
  stub is the cheap intervention, hooks may be unnecessary. Δ ≈ 0 → the stub
  doesn't change first-action behavior, which *justifies* stronger integration
  (arm C hook / init). Report Δ with a 95% CI; do not gate on a threshold.
- Same model (claude-opus-4-8), same 10 tasks, same scorer. Aim for enough
  arm-B runs to pair against the arm-A baseline; disclose aborts.
- Freshness is now a design input, not just a metric: keep the test skeleton
  version-matched to the brain so the R3 banner doesn't confound Δ.

Corpus review (billing/courier/webhooks phrasings) proceeds in parallel —
independent of the intervention experiment.

## Status

- [x] R1 hook + server instrumentation + scorer + aggregator + tasks
- [x] Harness validated end-to-end (synthetic + real runs; 5 fixes)
- [x] Stage 1 batch — stopped at n=7 (underpowered by choice; ≈6-runs/login cap)
- [x] **Milestone closed: infrastructure validated; behavioral hypothesis
      refined.** Not an R1 pass/fail. Full write-up in `FINDINGS.md`.
- [ ] **Phase 2.6 — Retrieval Intervention:** Arm B (tool + stub) measuring
      Δ(retrieval-before-code) vs this milestone's Arm-A baseline. New milestone,
      not an extension. Pre-registered above.
- [ ] (Later) R1b full-workflow realism check — packages installed, end-to-end

## Milestone conclusion

Semantic retrieval is reliable, low-latency, and voluntarily discoverable under
the tested conditions. Remaining uncertainty is about **retrieval timing, not
capability**: models frequently begin with local workspace exploration (Bash)
before consulting the brain. Highest-value engineering insight: **brain
freshness is a behavioral dependency** — a version-skew warning appears to
suppress retrieval, making freshness a first-class Phase 3 feature. See
`FINDINGS.md` for the three confidence tiers and the Arm-B next step.
