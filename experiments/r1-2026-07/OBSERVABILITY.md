# Behavioral observability

The R1 harness, promoted from a one-off experiment to a **standing capability**:
track retrieval behavior over time so drift surfaces as a trend, not a surprise.

This is **observability, not a regression gate.** The thing under test is a
*distribution* (does the model retrieve before code?), not a return value, so
the artifact is a monitored signal with informational bands — never a green/red
per-commit assertion. A flag means "look", not "block".

## What it tracks

Per ledger entry (one panel run): P(before-code | tool), P(before-code | stub),
Δ, median retrieval latency, arm-B first-action distribution, wrong/missed
retrieval, plus the model and the brain's `sdkVersions` at the time.

## Cadence — human-initiated, not per-commit

Panel runs cost paid model calls (and hit session limits), so they are **not** a
CI gate and **not** an unattended schedule. Run `observe.sh run` on:

- a **Fonderie SDK release** (new package versions change the brain surface),
- a **major dependency / model change** (new default model, Claude version bump),
- a **quarterly** heartbeat otherwise.

The drift *reader* (`drift.mjs`) is free and deterministic — run it anytime.

## Why not a scheduled CI job

Deliberate, per the program's principles (see `FINDINGS-2.6.md`, `README.md`):
a scheduled job spending money unattended is an expensive default that's hard to
reverse and easy to let rot. Human-initiated is the **reversible** choice; if a
release cadence proves it's worth automating, promote it to a `workflow_dispatch`
job later — a decision to make on evidence, not up front.

## Files

| File | Role |
| --- | --- |
| `observe.sh run [model]` | run the paid panel (arm A + arm B), score, record |
| `observe.sh record` | re-record a ledger row from existing `results/` (no runs) |
| `observe.mjs` | scored runs → one `ledger.jsonl` summary row |
| `drift.mjs` | render the ledger over time; flag informational bands (never gates) |
| `ledger.jsonl` | the time series (committed — this is the durable signal) |

## Informational bands (investigate, don't fail)

Movement past these prompts a look, not a block (`drift.mjs` flags them):

- P(before-code | stub) < 0.80
- Δ < 0.20 (stub advantage narrowing toward the "not meaningful" band)
- median retrieval latency > 200 ms

## Reading a flag — boundary, not refutation

A flag (e.g. a new model retrieves before-code 60% of the time) locates a
**boundary of validity**, it does not refute the architecture. The scoped
conclusion from Phase 2.6 was explicitly "under the tested conditions." A flag
says the conditions changed — investigate which (tool-use priors? instruction
surface? client contract?) and record the boundary. Revisit the stub-first
decision only if the evidence shows it fails inside the envelope we care about.

## Freshness precondition

`observe.sh run` aborts if the test skeleton's `@fonderie/core` doesn't match the
brain: a version-skew banner suppresses retrieval (the Phase 2.5 finding), which
would confound the signal. Keep the skeleton version-matched before a panel run.
