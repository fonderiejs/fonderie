# Decision: instrument the transcripts before spending on more runs

_2026-07-20. Records the reasoning behind spending $0 on transcript
instrumentation instead of $6 (pb-scoped pilot) or $50 (full batch) next._

## The problem the pilot exposed

The two attribution methods disagreed 7× (Method A resident-only = 0.10;
Method B empirical = 0.71). That is not a real disagreement about pb's cost —
**both proxies are bad:**

- **Method A** counts only the resident artifact, ignoring knowledge the model
  *fetches* at runtime via `brain_query`.
- **Method B** = `cacheRead(cond) − cacheRead(scratch)`, but per-turn cacheRead
  is remarkably flat across conditions (24K–41K/turn); the cumulative total is
  driven by **turn count**, which swung 2–3× at n=1 (fat-s1 ran 67 turns,
  pb-s2 ran 39) and is further confounded by scratch writing different code.

Per-turn cacheRead (the evidence):

| session | turns | cacheRead | /turn |
| --- | --- | --- | --- |
| pb s1   | 23 | 588,836   | 25,602 |
| pb s2   | 39 | 1,616,429 | 41,447 |
| fat s1  | 67 | 2,309,909 | 34,476 |
| fat s2  | 25 | 610,595   | 24,424 |
| scratch s1 | 20 | 315,684 | 15,784 |
| scratch s2 | 15 | 172,210 | 11,481 |

## The insight

**Turn count is a separate axis (efficiency) from knowledge weight.** Method B
conflates them. Attributing fat's 67-turn auth session to "Fonderie knowledge
overhead" is wrong — those turns are iteration, not knowledge. The honest metric
separates two things:

1. **Per-turn Fonderie-knowledge footprint** (turn-neutral): resident tokens +
   fetched-knowledge tokens amortized per turn. This is "how heavy is the
   Fonderie knowledge the model carries each turn" — the thing the ⅓ goal is
   really about. For fat it is ≈ the 28K skill; for pb it is the small resident
   CLAUDE.md + whatever `brain_query` pulled in.
2. **Turn count** (efficiency): did pb need more/fewer turns to reach equal
   quality? A real finding, but a *different* one — not knowledge overhead.

Measured directly from the transcripts (per-turn `usage`, matched `brain_query`
tool_use→tool_result), both are computable **from data we already have, for $0.**

## Why this is the best ROI

- **$0** — pure analysis of captured pilot transcripts; no new runs.
- **Resolves the 7× A/B gap** into one defensible number, and tells us WHERE the
  overhead lives: resident, fetched, or turn-inefficiency.
- **De-risks every downstream spend.** pb-scoped ($6) and the full batch ($50)
  would otherwise measure numbers we can't interpret. Instrumentation says which
  lever matters first:
  - resident-dominated → `pb-scoped` is the fix (already built) → run that pilot;
  - fetched-dominated → trim the `brain_query` payload instead;
  - turn-count → neither knowledge lever helps; drop the fraction goal honestly.

## Decision

Build `instrument.mjs` (transcript-level Fonderie-knowledge attribution) and run
it on the pilot data **before** any further paid run. Ranking:

1. Transcript instrumentation — **$0, do first** (this decision).
2. `pb-scoped` re-pilot — $6, only if #1 shows resident is the lever.
3. Full N=3 batch — $50, only once a design can plausibly clear ⅓, else to
   quantify parity-plus.

Spending on #2/#3 before #1 is optimizing blind. The pre-registered decision
rule and thresholds are unchanged; this only replaces two bad proxies with a
direct measurement.

## Result (instrument.mjs, 2026-07-20) — the divergence resolves toward FRACTION

Turn-neutral Fonderie-knowledge footprint, measured directly from transcripts:

| cond | resident_K | fetched (Σ brain_query) | tok/turn | pb/fat |
| --- | --- | --- | --- | --- |
| fat | 27,999 | 0 | **27,999** | — |
| pb  | 1.5K→5.6K | ~6K total (2–4 calls) | **3,700** | **0.132** |
| scratch | 0 | 0 | 0 | — |

- **pb/fat = 0.13 → FRACTION (≤⅓).** On the direct Fonderie-knowledge metric,
  pb carries ~13% of fat's per-turn knowledge weight. This **reverses the
  tentative parity-plus read**: Method B's 0.71 was over-attributing non-Fonderie
  context (app code, tool results, turn-count) to Fonderie. Fetched knowledge is
  small (~6K), so Method A was directionally right; Method B was the bad proxy.
- This is a **better estimator of the SAME locked metric** ("cache_read + input
  attributable to skill/brain content"), not a goalpost move — it measures
  skill/brain content directly instead of "everything above scratch."
- **Separate finding (efficiency axis, NOT knowledge overhead):** turn counts
  fat 93 / pb 61 / scratch 31 (mean). Both Fonderie conditions take more turns
  than raw scratch — a real $ cost the knowledge metric does not capture, and a
  distinct thing to investigate. pb still uses **fewer** turns than fat.

### What changed and what it means

Instrumenting first (for $0) changed the conclusion: the fraction goal looks
**reachable, likely already met on knowledge weight** — we nearly abandoned it
on a confounded proxy. Still **n=1 → directional.** The full N=3 batch is now
worth running to CONFIRM fraction (not to chase a lost goal), with two metrics
reported: per-turn knowledge footprint (the goal) and turn efficiency (the
separate cost). `pb-scoped` becomes optional upside, not the rescue.
