# Fonderie Brain — Multiphase Plan (v2)

> Goal: ship a SaaS with a fraction of the token cost. Tokens are spent
> understanding the **user's** project, never re-understanding Fonderie.
> Method: extract the proven mechanics from graphify (Graphify-Labs/graphify),
> applied to a context we control end-to-end.
> Guiding constraints: **less moving pieces = better**, and **the architecture
> is the differentiator** — JS is commodity, the durable standard is not.
> Writing the code is not the risk; committing to the wrong architecture is.
> Every phase below therefore gates on *evidence about the architecture*
> (does the model use it? does retrieval hit? does the version match?), never
> on "is the code done."

## Program-level rules (apply to every phase)

- **Gate discipline:** a failed exit gate gets exactly one iteration. If it
  fails twice, the phase ends, the program stops, and the fat skill stays.
  Gates are not renegotiated mid-phase.
- **One model for all measurements** (currently `claude-opus-4-8`); model
  changes reset baselines, never get compared across.
- **No claim without a gate:** we do not advertise support for an assistant,
  a cost number, or a quality score that hasn't passed a gate below.

## What graphify proved (the parts we borrow — verified against their repo)

| Graphify mechanic | Why it works | How we apply it |
| --- | --- | --- |
| Local AST parsing (tree-sitter), zero LLM calls for structure | Structural knowledge costs $0 in tokens | Indexing and querying never call an LLM |
| Single flat artifact (`graph.json`), no DB, no service | One file, one process, nothing to operate | `brain.json` shipped inside the npm tarball |
| MCP server with few narrow tools (`query_graph`, `get_node`, `get_neighbors`, `shortest_path`), stdio | Model pulls hundreds of tokens per question instead of reading files | 3–4 tools, stdio only |
| **PreToolUse hooks on Claude Code / Gemini CLI** — intercept file-read/search *before* it happens | Deterministic enforcement; doesn't rely on the model obeying instructions | Primary R1 mechanism (see Phase 2) |
| Per-assistant install matrix: hooks (Claude Code, Gemini CLI), instruction files (`AGENTS.md`, `.cursor/rules/` for Codex/Cursor), native skill dirs (Kilo, Kiro) | One command, 20+ assistants, vendor differences isolated | Phase 3 copies this tiering wholesale |
| Incremental reindex (`--update` changed files only), post-commit auto-rebuild ($0), **git merge driver union-merging `graph.json`** | Overlay stays fresh with zero cost and no merge conflicts in teams | `fonderie brain index` adopts all three (Phase 2) |
| Public-benchmark evaluation (LOCOMO, LongMemEval) instead of self-made scores | Claims survive skeptical readers | Reinforces R4: external anchors + published recall@k |

**Cautionary data point (validates R2):** graphify's keyword-scoped retrieval
scores 49.7% recall@10 on LOCOMO and 76% QA on LongMemEval-S — keyword-only
retrieval is mediocre on naturally-phrased questions. Confirms no-embeddings
is viable, and confirms our ≥90% naive-phrasing gate will NOT come free from
BM25 alone. Our edge over them: a closed, known SDK surface lets us hand-curate
alias/synonym edges ("pay" → billing, "login" → auth); they can't for
arbitrary repos.

Our structural advantage: graphify indexes *arbitrary* repos at the user's
expense; **our SDK surface is versioned and known at publish time**, so the
graph is pre-built once per release in CI. Users only index their thin
product layer.

## The four named risks (each owned by a phase gate)

| # | Risk | Failure mode | Owned by | Prior art status |
| --- | --- | --- | --- | --- |
| R1 | **Triggering** — the model ignores the brain and answers from priors or by reading files | Plausible wrong wiring; silent quality collapse | Phase 2 + 4 gates (tool-call rate) | **Solved by graphify**: PreToolUse hooks — adopt hook-first |
| R2 | **Retrieval** — naive phrasing ("let people pay") misses the right nodes | Brain answers the wrong question confidently | Phase 0 + 2 gates (naive-phrase hit rate) | **Validated as hard** by graphify's ~50–76% benchmark scores; ours to solve via curated alias edges |
| R3 | **Version skew** — brain serves 1.3.0 knowledge against user's installed 1.1.0 | Model writes against APIs the user doesn't have | Phase 2 gate (lockfile-matched brain) | **No prior art** — graphify indexes one working tree; this is our build and our differentiator |
| R4 | **Credibility** — self-written, self-scored benchmark, N=3 | Public claim dismissed as grading our own homework | Phase 4 gate (external anchor, N≥5) | **Precedent from graphify**: public-benchmark reporting |

---

## Phase 0 — Extraction study + baseline (3–4 days, no code shipped)

> Scope reduced: the mechanics questions (tool surface, install matrix,
> incrementality, hook enforcement) are now answered from graphify's repo —
> see the borrow table above. What remains empirical is *our* retrieval
> quality and *our* baseline.

- Run graphify against `fonderie-js` and one skeleton-b app. Record graph
  size, query quality on our corpus, tokens per answered question.
- **R2 groundwork:** collect a **naive-phrasing corpus** — 30–50 real user
  formulations of the 10 canonical tasks (Discord/support history, plus
  adversarially generated paraphrases: "let people pay", "add login",
  "teams like Slack"). This corpus, not our phrasing, is the retrieval
  eval set for every later gate.
- Refresh the token-cost harness baseline (`experiments/token-cost-2026-07`)
  on the standardized model.
- **Exit gate:** written mapping of which node/edge types answer each corpus
  cluster. If plain-file grep answers them as cheaply, stop here.

## Phase 1 — Ship the graph, not a service (2 weeks)

- CI step at publish builds `brain.json` **per package version** from
  packages/* — nodes: modules, exports, types, recipes; edges: `imports`,
  `requires`, `configures`, `secures`, `billed-by`, `emits-event`.
- **R3 groundwork:** brain artifacts are versioned and retained per SDK
  release (a `brains/` registry keyed by package@version), not just
  "latest". Building only HEAD's brain is a gate failure.
- Invariants encoded as edges, not prose (the 1.2.0 lesson).
- Deliverable: artifact + `fonderie brain query` for manual verification.
- **Exit gate:** ≥90% of the naive-phrasing corpus answerable from
  `brain.json` alone, each answer ≤ 800 tokens.

## Phase 2 — MCP server, minimal surface (2–3 weeks)

- `fonderie brain serve` (stdio only, no HTTP, no LLM inside):
  - `brain_query(question)` — ranked slice (BM25 + edge expansion)
  - `brain_node(id)` — one entity + immediate edges
  - `brain_recipe(name)` — canonical wiring + invariants
- **R3 — lockfile-matched serving:** at startup the server reads the user's
  lockfile and serves the brain matching their **installed** `@fonderie/*`
  versions. On mismatch or unknown version: refuse loudly with an upgrade
  hint — never serve newer knowledge silently.
- **R1 — hook-first enforcement (graphify's mechanism), stub as fallback:**
  - **Tier 1 (Claude Code, Gemini CLI):** register a PreToolUse hook at
    `init` that intercepts Read/Grep/Glob targeting `node_modules/@fonderie/*`
    or Fonderie docs and redirects to `brain_query`. Deterministic — does not
    depend on the model obeying instructions.
  - **Tier 2 (Codex, Cursor, others without hooks):** instruction-file stub
    with mandatory phrasing: *"Before writing or editing any code that
    touches auth, billing, orgs, permissions, email, webhooks, or config,
    you MUST call `brain_query` first. Do not read Fonderie source or docs;
    do not answer from memory."* Tool descriptions carry trigger conditions
    ("call this when…").
- **R2 — curated alias edges:** ship a hand-maintained synonym layer in
  `brain.json` ("pay/charge/checkout" → billing, "login/signup/SSO" → auth,
  "teams/orgs/workspaces" → workspaces). This is our closed-domain edge over
  graphify's arbitrary-repo retrieval; the naive-phrasing gate depends on it.
- User-project overlay: `fonderie brain index` — local tree-sitter parse of
  the user's app, linked to Fonderie nodes. Adopt graphify's freshness
  design: `--update` re-indexes changed files only, an optional post-commit
  hook auto-rebuilds ($0), and a git merge driver union-merges the overlay
  so team members' parallel commits never conflict.
- **Exit gates (all three):**
  1. R2: ≥90% retrieval hit rate on the naive-phrasing corpus via
     `brain_query` (automated eval, no LLM in the loop);
  2. R1: in 10 scripted cold sessions, `brain_query` fires before first
     Fonderie-touching edit in ≥9;
  3. Cold session answers "add team billing" using ≤ 2K tokens of Fonderie
     context.

## Command surface (`@fonderiejs/cli`, bin `fonderie`)

Rule: **daily human-facing verbs go top-level; plumbing stays namespaced under
`brain`.** `fonderie` is an umbrella CLI that will grow non-brain commands
(scaffolding, license, doctor) — and some brain verbs collide at the top level
(`fonderie serve` reads as "run my app server"; we are a backend SDK, that
word belongs to the user's intuition).

```
fonderie query "how do I gate a route by plan?"   # flagship — alias of brain query
fonderie init                                      # assistants + hooks + MCP registration
fonderie doctor                                    # env checks, includes brain verify

fonderie brain serve            # MCP server (wired by init; humans rarely type it)
fonderie brain index [--update] # build/refresh the user-project overlay
fonderie brain build            # publish-time graph build (CI only)
fonderie brain verify           # lockfile↔brain version match, hook registered,
                                #   overlay staleness (R3 made tangible; runs in doctor)
fonderie brain recipe <name>    # canonical wiring snippet + invariants
fonderie brain node <id>        # one entity + edges (retrieval debugging)
fonderie brain path <a> <b>     # shortest path between entities (from graphify)
fonderie brain eval             # run the naive-phrasing corpus gate locally —
                                #   shipped public; the R4 credibility story
```

Deliberately absent (violate "less moving pieces", serve no gate): `stats`,
`visualize`, `export`, HTTP mode.

## Phase 3 — One entry point, every model (1–2 weeks)

- Package **`@fonderiejs/cli`**, bin `fonderie`; `@fonderiejs/brain-core`
  internal. Command surface as defined above — `query`/`init`/`doctor`
  top-level, everything else under `brain`.
- `npx @fonderiejs/cli init`: detects installed assistants and applies
  graphify's proven install matrix — hooks for Claude Code/Gemini CLI,
  instruction files (`AGENTS.md`, `.cursor/rules/`) for Codex/Cursor, native
  skill directories where a platform has them. All vendor differences
  confined to `init`.
- **Claim discipline (R4-adjacent):** an assistant is "supported" only when
  it passes the Phase 3 gate on a fresh machine. Launch tier-1 targets:
  Claude Code and Gemini CLI. ChatGPT/Cursor/VS Code graduate to the
  supported list one by one as their gate run passes — until then the
  README says "experimental".
- **Exit gate:** fresh machine → working, lockfile-matched brain in every
  tier-1 assistant with one command.

## Phase 4 — Prove it with the existing harness (1–2 weeks)

- Add **condition C** to `experiments/token-cost-2026-07`: skeleton-b +
  brain + stub, fat skill removed. Naive prompt, same model as baseline.
- **R4 — methodology hardening:**
  - **N ≥ 5 runs per condition** (A, B, C), aborted runs disclosed as before;
  - checklist items **mapped to OWASP ASVS controls** where applicable, so
    the quality bar is externally anchored, not self-defined;
  - scoring script committed to the repo; anyone can re-run and re-score;
  - per-run `brain_query` call counts logged (R1 telemetry in the wild).
- **Ship gates (all four):**
  1. checklist ≥ 11/12 (median), with ASVS-mapped items itemized;
  2. `cache_read` drops ≥ 5× vs condition B;
  3. cost/run ≤ scratch-naive;
  4. `brain_query` fired before first Fonderie-touching edit in ≥90% of runs.
- Blog post ships only if all four hold: "We gave the model a brain instead
  of docs" — with the harness, corpus, and scorer public so the claim
  survives a skeptical reader.

## Phase 5 — Retire the fat skill (ongoing)

- Skill shrinks to the brain-first stub. FONDERIE.md remains for humans,
  exits the model's context.
- CI fails any PR adding a package/recipe without its graph nodes — the
  brain is built from source and cannot rot.
- Quarterly regression: re-run condition C **and** the retrieval eval on the
  (growing) naive-phrasing corpus. New real-user phrasings that missed get
  added to the corpus first, fixed second.

---

## What we deliberately do NOT build

No hosted service, no HTTP transport, no vector DB, no embeddings, no LLM
calls inside the tool, no per-assistant plugins beyond config writing, no
second user-facing package. One npm package, one flat artifact per SDK
version, one stdio process.

## Why this is the differentiator

Anyone can write the JS — we have for 12 years, through a new architecture
every month. What nobody ships is the **durable contract between an SDK and
every model that consumes it**: versioned knowledge that travels with the
package, retrieval that survives naive phrasing, and a benchmark anyone can
re-run. That contract — not the code — is what this plan protects.
