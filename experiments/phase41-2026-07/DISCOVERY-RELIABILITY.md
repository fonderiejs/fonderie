# Finding: discovery-reliability edge case + how to actually cover it

_2026-07-21. Surfaced by the N=3 batch (full 39-point rubric): pb scored 39/27/38
across sequences — one sequence (pb-2) shipped an incomplete app. This documents
the root cause and the honest engineering approach to covering it._

## The finding

In pb-2's **teams** session the model called `brain_query`, got the correct
`@fonderie/workspaces` answer + recipe — then **stopped to ask**: *"OK to add
these two dependencies? Which email provider?"* In a non-interactive run
(`claude -p </dev/null`) there is no one to answer, so the session ended with
teams/audit unbuilt (27/39). Two compounding factors:

1. **Autonomy:** the model asked instead of proceeding. pb-1 and pb-3 hit the
   identical discovery moment and just installed + built (39, 38). Same signals,
   different choice — model variance.
2. **A version-skew banner** read *"...before trusting it,"* nudging caution.

So the failure mode is **silent incompletion on a capability that required
installing a not-yet-present package.**

## Why the first fix is necessary but NOT coverage

The shipped fix (PR #30) made the guidance directive: *"when brain_query names an
uninstalled package, npm install + wire + continue; don't ask permission or
abandon; pick sensible defaults."* Plus a calmer, actionable version banner.

**This is the weakest layer, by the project's own R1 principle:** BRAIN_PLAN's
thesis is *"deterministic enforcement; doesn't rely on the model obeying
instructions."* A prompt telling the model "don't stall" is exactly the
instruction-reliance R1 was built to replace. An LLM will sometimes stall no
matter how good the wording. Guidance **reduces frequency; it cannot cover the
case.** Claiming coverage from Layer 1 alone would repeat the mistake.

## The right approach — defense in depth (weakest → strongest)

**Layer 1 — Directive guidance (DONE, #30).** Lowers probability. Necessary,
insufficient. Never the coverage claim.

**Layer 2 — Deterministic completion detection (LOAD-BEARING, to build).** The
failure is *detectable without trusting the model*: the task asked for teams, the
app shipped without the workspace routes/tables it implies. A post-session check
(or a Stop hook) that verifies the requested capability actually landed, and on
failure **re-invokes with a corrective directive or fails loudly — never passes
silently.** In production terms: a hook that notices "capability requested,
providing package absent, model didn't install it" and surfaces the exact
`npm i @fonderie/workspaces` instead of a dead-end. This is graphify's hook
mechanism — already the R1 plan. This is what *covers* the case.

**Layer 3 — Remove the friction that triggers the stall (root causes):**
- **Spurious skew:** discovery (`brain_query`) still compares against the central
  brain, not the installed co-located fragment, so it warns even when the
  installed package is fine (it warned on pb-2's `core 0.1.2` vs central `0.1.5`).
  Wire discovery to the installed fragment → the alarm disappears.
- **Decision points:** the "which email provider?" question was a place to stop.
  Give the brain a default provider recipe so there is nothing to ask.

**Layer 4 — Gate it (meta).** By R4 ("no claim without a gate"), silent
incompletion should be caught AT the gate, not weeks later by a rubric. A
per-session **completion gate** makes an incomplete session unable to pass —
turning "found in post-hoc scoring" into "the harness refuses to green it."

## Status

- [x] Layer 1 — directive guidance (#30)
- [x] Layer 2 — deterministic completion detect-and-recover. `run-sequence.sh`
      inspects the tree after each session: every `scope` capability must be
      present (its @fonderie package installed OR hand-rolled code for it). If
      not, ONE corrective re-invoke with an explicit "install + build, don't
      ask" directive. Doesn't trust the model's prose — inspects the artifact.
      Verified: pb-2's exact stall (workspaces absent, no workspace code) is
      detected and would trigger recovery.
- [x] Layer 3a — skew note SCOPED to the queried package + recipe deps (was
      project-wide; a stale unrelated `core` no longer spooks a `workspaces`
      query). Discovering a not-installed package yields no banner.
- [x] Layer 3b — `email-provider-default` invariant on the courier recipes:
      default to SMTP-from-env, don't stop to ask which provider.
- [x] Layer 4 — per-session completion gate. `completed`/`recovered` recorded
      in meta; a session that never delivers its scope is flagged loudly and
      cannot pass silently.

All four layers are in code. Layers 2+4 are proven END-TO-END by a forced-stall
fixture (`test-l2-recover.sh`, \$0, no model): a fake model stalls, the real
harness detects the missing capability, fires the corrective re-invoke, and
recovers — while a never-completing model trips the loud gate. Layer 1 was
verified in a live re-run (pb-verify). A full paid batch re-run remains as the
only-in-production confirmation, but the coverage mechanism itself is now tested,
not asserted.

## Verification note (Layer 1 only)

A single re-run (`pb-verify`, sessions 1→3) tested Layer 1 on the exact scenario.

**Result — the guidance flipped the behavior:**

| | pb-2 (before) | pb-verify (after #30) |
| --- | --- | --- |
| teams session turns | 6 | 52 |
| declined / asked permission | yes | no |
| `@fonderie/workspaces` installed | no | **yes** |
| `@fonderie/courier` (invite email) | no | **yes** |
| teams/invite routes built | no | **yes** |

On the exact scenario that failed, the model now installs the packages and
builds the feature instead of stalling. Strong signal that Layer 1 helps — but
it is **one sample of a probabilistic mitigation, not coverage.** Layers 2–4
remain required to *ensure* the edge case is covered, because "usually proceeds"
is not "always completes." The next model, prompt, or task may still stall;
only deterministic detection (Layer 2) + a completion gate (Layer 4) close it.

## Production confirmation — pb re-run, 2026-07-21 (12/12)

Re-ran the full pb condition (3 sequences × 4 sessions) with all layers active,
to confirm in production what the fixture proved deterministically.

**Result: 12/12 sessions completed. Zero real stalls. Zero Layer-2 recoveries
needed. Zero (real) gate failures.**

| seq | s1 auth | s2 billing | s3 teams | s4 security |
| --- | --- | --- | --- | --- |
| r1 | ✓ | ✓ | ✓ | ✓ |
| r2 | ✓ | ✓ | ✓ | ✓ |
| r3 | ✓ | ✓ | ✓ | ✓ |

The teams session (s3) — which stalled in the original batch (pb-2, 27/39) —
completed in **all 3** sequences: each installed `@fonderie/workspaces` +
`@fonderie/courier` and built the invite flow (19–26 workspace/invite refs).
Security (s4) built audit in all 3.

**What it means:** the original 1-in-3 stall did NOT recur. Layers 1+3 (directive
guidance, scoped skew note, default email provider) prevented the stall
*upstream*, so Layer 2 (detect-and-recover) never had to fire — the ideal
outcome. Layer 2 remains proven as the safety net by `test-l2-recover.sh`; it is
there for the case guidance doesn't catch, not relied upon as the first line.

**Two harness bugs found and fixed live during this run** (the gate correcting
itself): a session-limit stub was first marked `completed:true` (#32), then
over-corrected to a GATE-fail (#33). Final rule: a limit-truncated session is
INCONCLUSIVE — no verdict, re-run on resume. The one GATE line in the old logs
(pb-r3-s2) was that false positive; the honest re-run shows it `completed ✓`.

Discovery-reliability edge case: **covered (4 layers) and confirmed in production.**
