# Graphify study protocol + results log

Purpose: run graphify (Graphify-Labs/graphify) against our own code to answer
the two remaining Phase 0 empirical questions on *their* engine before we
build ours: (a) does keyword-scoped graph retrieval hit our corpus, (b) what
does the graph cost/weigh on a repo our size.

## Setup

```sh
pipx install graphifyy        # or: uv tool install graphifyy
cd fonderie-js
graphify extract .            # AST-only for code, $0; skip doc/LLM passes first
# repeat in ../experiments/token-cost-2026-07/skeleton-b
```

Record: extraction wall time, `graph.json` size, node/edge counts,
community count (Leiden), and whether the 18 packages come out as
recognizable communities.

## Retrieval pass

For each entry in `corpus.md`:

```sh
graphify query "<entry>"
```

Hit = returned subgraph contains the required nodes for that entry's task
(per `canonical-questions.md`). Log below.

## Results (run 2026-07-17, graphify 0.9.18, --code-only)

| Metric | fonderie-js | skeleton-b |
| --- | --- | --- |
| Extraction time | 46 s (483 files, 8 workers) | 1.4 s (3 files) |
| graph.json size | 2.8 MB | tiny |
| Nodes / edges | 3,098 / 5,249 | 36 / 33 |
| Communities | 244 (far more than 18 packages — noisy) | 7 |
| Corpus hit rate, **loose** (any node from expected package) | **18/32 = 56%** | n/a |
| Corpus hit rate, **strict** (≥3 src/ nodes from expected package) | **12/32 = 38%** | n/a |

Notes: 41 `.sql` migration files skipped (tree_sitter_sql not installed);
experiment-artifact JSON files polluted the scan (should be excluded).
Scoring was automated (grep for `packages/<pkg>/` in the returned subgraph);
even loose "hits" often bury the right node in unrelated noise (e.g.
"let people pay" returned mostly logger nodes + billing package.json
keywords — a hit by the letter, useless as a ≤800-token slice).

### Per-entry misses (14 loose misses)

| Corpus entry | Miss class | Fixable by alias edge? |
| --- | --- | --- |
| users should stay signed in | vocabulary ("signed in" ≠ session) | yes (session/signed-in → auth) |
| only logged in people can see the dashboard | vocabulary + structural (needs `requireSession` middleware node) | alias + recipe node |
| protect this endpoint | same as above | alias + recipe node |
| multiple people share one account | vocabulary | yes (→ workspaces) |
| monetize the app | vocabulary | yes (→ billing) |
| charge per seat | vocabulary ("seat") | yes (seat → billing×workspaces) |
| free tier limited to 3 projects | vocabulary ("tier", "limit") | yes |
| make some users admins | vocabulary ("admin") | yes (→ permissions) |
| only owners can delete stuff | vocabulary ("owner") | yes |
| forgot password email | vocabulary (reset flow spans auth+courier) | alias + recipe node |
| email people when they get invited | structural (spans workspaces+courier+events) | recipe node |
| handle stripe events | vocabulary ("events" hit events pkg, not webhooks) | yes + invariant node |
| tell other apps when something happens here | vocabulary | yes (→ webhooks) |
| stop bots hammering the login | vocabulary ("bots", "hammering") | yes (→ rate-limit) |

**Miss breakdown: ~10/14 pure vocabulary (alias-fixable), ~4/14 structural
(need `recipe:*` / cross-package nodes).** This is precisely the split the
plan bet on: the closed-domain alias layer + recipe nodes are the delta
between graphify's floor and our ≥90% gate.

### Interpretation vs the exit gates

- Raw graphify floor: 56% loose / 38% strict — mirrors their published
  LOCOMO-class numbers. Neither early-exit branch triggers: graphify alone
  is NOT ≥90% (so a thin wrapper isn't enough), and grep would fail the same
  vocabulary misses ("monetize", "admins", "bots") at least as badly, so the
  program does not stop.
- Second, independent argument for the brain: even on hits, raw subgraphs
  are noisy (logger contamination, package.json keyword nodes, 244
  communities). The ≤800-token slice requires our curation (alias edges,
  recipe/invariant nodes, per-package scoping) — not just their engine.

## Interpretation guide

- Raw graphify hit rate is our **floor** — they have no alias layer and no
  recipe/invariant nodes. Expect well under 90%; the question is *how far*
  under and whether misses cluster on vocabulary (alias-fixable) or on
  structure (needs recipe nodes).
- If raw graphify already hits ≥90%: strongly consider building far less
  (thin wrapper + shipped graph) — update BRAIN_PLAN.md before Phase 1.
- If grep over packages/* matches graphify's hit rate at similar token cost:
  program stops (plan gate rule).
