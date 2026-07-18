# Phase 0 — Extraction study + baseline

Executes Phase 0 of [`BRAIN_PLAN.md`](../../BRAIN_PLAN.md). Scope: 3–4 days,
no shipped code. Mechanics questions are already answered from graphify's
repo (see the plan's borrow table); this phase measures the two things that
remain empirical — **our retrieval quality** and **our cost baseline**.

## Contents

| File | What it is |
| --- | --- |
| `corpus.md` | Naive-phrasing corpus — real-user formulations of the 10 canonical tasks. The retrieval eval set for every later gate. |
| `canonical-questions.md` | The 10 canonical tasks + node/edge mapping template (the Phase 0 exit-gate deliverable) |
| `graphify-study.md` | Protocol + results log for running graphify against fonderie-js and skeleton-b |

## Protocol

1. **Corpus review (human).** `corpus.md` starts with generated adversarial
   paraphrases. Replace/augment with real phrasings from Discord/support
   history before treating any number as real. Target 30–50 entries.
2. **Graphify run.** `pipx install graphifyy` (or `uv tool install graphifyy`),
   then follow `graphify-study.md`. Record graph size, and for each corpus
   entry whether `graphify query` surfaces the right node(s) — hit/miss only.
3. **Baseline refresh.** Re-run `../token-cost-2026-07/run.sh` for conditions
   A and B, ≥3 runs each, **standardized model** (`claude-opus-4-8` — see
   plan program rules). Runs cost real money; get sign-off first.
4. **Exit gate.** Fill the mapping table in `canonical-questions.md`. Decision:
   if plain-file grep answers the corpus as cheaply as the graph, the program
   stops here (per plan gate discipline).

## Status

- [x] Scaffold + generated corpus draft
- [ ] Corpus reviewed against real user phrasings (human)
- [x] Graphify installed + run against fonderie-js (see graphify-study.md)
- [x] Graphify run against skeleton-b app
- [x] Baseline refresh — COMPLETE: 3 valid isolated runs/condition on
      claude-opus-4-8 (scratch bl2-a1/a2/a4, fonderie bl2-b1/b5/b6) in
      ../token-cost-2026-07/results.csv (round 0-baseline). Scored against the
      now-committed CHECKLIST.md; per-run breakdown in SCORES.md.
      Medians: scratch $0.34 / 117 LOC / 9-12; fonderie $0.60 / 50 LOC / 12/12.
      NB: first attempt (bl-*) contaminated (condition A resolved @fonderie
      inside the repo); fixed by isolating the workdir. 4 further runs lost to
      a session limit; completed after account switch. All disclosed in CSV.
- [x] Committed 12-point checklist (CHECKLIST.md) + per-run scores (SCORES.md)
      — closes the R4 "self-graded, rubric not committed" gap for Phase 4.
- [~] Exit-gate mapping — baseline done; still needs human corpus review +
      canonical-questions.md table fill for the final go/no-go.
