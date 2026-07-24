# Experiment docs — verification index

_Single record of a 2026-07-24 verification pass over the tracked experiment
docs. Kept as an index (not per-doc stamps) so that **pre-registered designs and
raw results stay byte-for-byte immutable** — post-hoc checks live here, never
inside the artifacts they check (same rule as `multi-module-2026-07/VERIFICATION-R5.md`)._

## Scope

40 tracked `.md` docs under `experiments/` (excludes `node_modules/`, skeleton
`.claude/` snapshots, and the skeleton source dirs themselves).

## What was checked, and at what depth

**Mechanical — all 40:**
- ✅ None empty / unreadable.
- ✅ Cross-references resolve. The handful that a naive path-checker flags
  (`src/auth/passwords.ts`, `CLAUDE.md`, `.meta.json`, `brain-query.mjs`, …) are
  **not defects** — they point at per-run trees the AI generated under the
  gitignored `runs/`, at skeleton internals (`skeleton-b5/src/index.ts`), or are
  `../`-relative — all intentionally not committed at the literal path. Shared
  anchors that *should* resolve do: `BRAIN_PLAN.md`, each `DESIGN.md`,
  `contract-tests.postman_collection.json`, sibling-dir links.

**Content — entry points + launch-relevant docs (read end-to-end):**
- ✅ All 6 experiment `README.md`s — coherent, correctly describe their
  experiment, cross-link the plan / design / blog.
- ✅ `client-app-rewrite/RESULTS-PHASE1-RERUN.md` and `multi-module-2026-07/DESIGN-R5.md`
  — already verified earlier this session (see that dir's `VERIFICATION-R5.md`).

**Preserved, not re-adjudicated (~22 docs):** pre-registered designs
(`DESIGN.md`, `DESIGN-R5.md`, `GATE.md`), raw results and scorecards
(`RESULTS-*`, `BATCH-RESULTS.md`, `SCORES.md`, `scorecard-*`, `FINDINGS*`,
`DISCOVERY-*`, `DECISION-*`, `PILOT-FINDINGS.md`). These are experimental record
— verified readable and internally referenced, **not edited and not re-scored**.
Re-adjudicating locked benchmark data would defeat its purpose; "verified" here
means intact and consistent, not re-run.

## Verdict

The experiment-doc set reads correctly and is internally consistent. No broken
links, no empty files, no stale-fact edits required. Immutable artifacts remain
untouched by design; this index is the durable "verified 2026-07-24" marker for
all of them.
