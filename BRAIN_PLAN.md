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

### Deferred: extract `scripts/` → `packages/cli/` (archived 2026-07-19)

The brain tooling currently lives in `scripts/*.mjs` (12 of the 14 files
there — MCP server, CLI, hook, shared libs, generators, tests). That is a
product-in-waiting, not a pile of scripts; its convention-correct home in
this monorepo is a package. **Deliberately not done now** — the mechanism
is still under validation (R2/R3), and extraction means real `tsup` /
`tsconfig` / `bin` wiring plus `.mjs`→`.ts`, which the plan defers to this
phase. When we do it, go straight here — skip any interim `scripts/`→
`tools/` rename (cosmetic, would be redone). Proposed layout:

```
packages/cli/
  src/
    mcp/       brain-serve.ts          # stdio MCP server
    cli/       query.ts, concepts.ts   # fonderie query / --concepts
    hook/      pretooluse.ts           # the R1 PreToolUse hook
    generate/  signatures.ts, outcomes.ts, brain.ts, project-brain.ts
    lib/       brain-lib.ts, fragment.ts
  bin/         fonderie                # umbrella entry (command surface above)
scripts/       audit-validation.mjs, strip-coauthors.sh   # genuine chores stay
```

Side benefit: kills the `**/scripts/*` gitignore force-add friction — new
files under `packages/` need no allowlist entry. Until then, tracked
scripts stay on the per-file `.gitignore` exception list (by design: local
scratch scripts remain ignored).

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

---

# Phase 4.1 — pre-registration (2026-07-19)

> Appended after the Phase 4 condition-C result
> (`experiments/token-cost-2026-07/FINDINGS-condition-c.md`): the topology
> brain LOST on cost for a small scoped task (classified negative — retrieval
> density + model preference for compiler feedback over drill-down). This
> section pins the goal numerically, records the architecture pivot the
> evidence dictates, and pre-registers the benchmark + decision rule BEFORE
> any build or spend. Thresholds are locked ahead of the data.

## The goal, operationalized (it never was)

Quality floor on both goals: checklist ≥ 11/12 (ASVS-anchored, CHECKLIST.md) —
cost may not be won by shipping worse code.

- **Goal A — single task (parity claim):** naive-prompt build with Fonderie
  costs **≤ 1.1× scratch** at quality floor. Status: nearly met (best baseline
  fonderie runs $0.40 @ 12/12 vs scratch $0.34 @ 9/12); needs N≥5 confirmation,
  not invention.
- **Goal B — sustained work (the "fraction" claim):** across a repeated-session
  workload (≥4 sessions on one growing app), **Fonderie-knowledge overhead per
  session** (cache_read + input attributable to skill/brain content) is
  **≤ ⅓ of the fat-skill baseline** at equal quality. This is the only regime
  with something to amortize — a single small task cannot physically yield
  "a fraction" (condition C measured why).

## Architecture pivot: the brain becomes a compiler

Every measured finding converges on compile-time knowledge, not runtime
retrieval:

| Finding (measured) | Design consequence |
| --- | --- |
| `brain_node` got 0 calls even when instructed (ce1) | Knowledge in files/context, never behind an optional hop |
| Topology-only → 34 turns of tsc iteration (c1) | Serve exact signatures — sufficiency is non-negotiable |
| Fat skill wins small tasks | Its sufficiency is right; its breadth (18 pkgs every session) is the waste |
| Retrieval's real edge is selectivity | Scope knowledge to the project's lockfile |
| Freshness is behavioral (R3) | Regenerate on install/update → version-matched by construction |
| `generatedAt` lesson | Byte-reproducible output |

**Project brain**: `generate-project-brain.mjs` compiles ONE deterministic file
per project — exact signatures + outcomes + invariants for ONLY the installed
`@fonderie/*` packages (lockfile-keyed). The model reads one sufficient,
project-specific file; zero retrieval behavior required. The MCP server keeps
exactly one job files can't do — **discovery** of not-yet-installed
capabilities — and there `brain_query` returns the top package's signatures
**inline** (bounded to one package), because the model measurably will not
come back for them. Phase 5's "retire the fat skill" is now: fat skill → stub
+ compiled project brain.

## The benchmark (Retrieval Advantage, repeated-session core)

- **Workload:** one app, 4 sequential sessions on the same growing codebase —
  (1) add auth; (2) add billing + plan-gating; (3) add teams/workspaces with
  invite emails; (4) security pass (rate-limit reset/invites + audit logging).
  Mirrors the multi-module stage prompts already in the repo.
- **Conditions** (identical session sequences): fat skill · project brain
  (regenerated between sessions as packages land) · scratch control (quality
  floor only).
- **N ≥ 3 full sequences per condition** (single-run variance measured at
  34-vs-22 turns makes n=1 worthless), aborts disclosed, one model
  (claude-opus-4-8), version-matched throughout.
- **Primary metric:** Fonderie-knowledge tokens per session + cumulative cost
  across the 4 sessions at checklist-equal quality. Secondary: turns, LOC,
  whether the project brain's advantage GROWS with sessions (the amortization
  signature). Session 1 doubles as the Goal-A N≥5 confirmation cell.

## Decision rule (locked before data)

- Project-brain cumulative Fonderie-overhead **≤ ⅓** of fat skill → Goal B met;
  ship the compiler as the `init` default; the "fraction" claim is earned.
- **⅓–1×** → parity-plus: ship for freshness/selectivity; retire the
  "fraction" headline.
- **≥ 1×** → kill rule fires: the cost thesis dies; the product claim becomes
  the already-measured correctness density (parity cost, 12/12 vs 9/12, half
  the code, scratch's 3 recurring flaws fixed by default).

Gate discipline unchanged: one iteration per failed gate; no claim without a
gate; aborts disclosed, never averaged.

---

# R2 update (2026-07-19) — concept enum replaces free-text discovery

> Appended after researching multilingual retrieval. Conclusion: R2 was a
> translation problem disguised as a retrieval problem, and the Phase 4.1
> pivot already shrank its surface to one tool. Close it there.

## The finding

R2's failure mode — "let people pay" missing the billing node — is
intent-to-vocabulary mapping, which string matching does badly (graphify's
~50–76% on LOCOMO/LongMemEval) and an LLM does extremely well. Our query
side is not a human typing into a search box; it is a model formulating a
tool call. The MCP tool-design literature is unanimous: free-text
parameters are a primary cause of failed/wrong tool calls; closed
enums make the model perform the mapping itself, reliably.

Both sides of our problem are closed: the SDK surface is known at publish
time, and the consumer is an LLM. General retrieval assumes an open
vocabulary on at least one side — we never had that problem.

## Design consequence

After the Phase 4.1 pivot, the only free-text retrieval left is the
discovery tool (`brain_query` for not-yet-installed capabilities).
Replace its parameter:

```
before:  brain_query(question: string)          → BM25 + edge expansion
after:   brain_query(concept: <enum>, aspect?)  → deterministic lookup
```

- **Concept enum**: one language-less ID per capability
  (`billing.subscriptions`, `auth.sessions`, `workspaces.roles`, …),
  a few dozen values, generated per release in CI from packages/*.
  Each value carries a one-line English description ("accept payments,
  subscriptions, Stripe") — the model bridges from any user language to
  the concept through the description; no per-language alias tables ever.
- **Curated alias edges are superseded.** The hand-maintained synonym
  layer ("pay/charge/checkout" → billing) becomes the enum descriptions —
  same curation effort, but consumed by the model instead of BM25, so it
  works in every language the model speaks.
- **Result is the concept's whole bounded subgraph** (one package's
  signatures, inline, per the ce1 lesson — the model will not come back
  for a second hop). No ranking, no recall, nothing to miss. The residual
  error is a wrong enum pick — rarer, visible (wrong signatures come
  back), and self-correcting via retry; a BM25 miss returns silence and
  the model improvises, which is the dangerous case.
- **BM25 survives only for exact-symbol lookup** (function/route names
  are already language-neutral).

## Gate change (locked before data)

The ≥90% naive-phrasing gate becomes: **≥90% correct concept selection on
the naive-phrasing corpus, run in EN and FR** (crewfinding supplies the
bilingual corpus), same threshold both languages, one model
(claude-opus-4-8). Note the eval now has the model in the loop — it
measures the enum mapping, which *is* the mechanism; the old no-LLM eval
measured BM25, which no longer exists on this path. Embeddings
(BGE-M3 / mE5) enter consideration only if this gate fails twice —
a measured decision, never a default. "No embeddings, no LLM calls inside
the tool" still holds: the mapping happens in the caller's tool call,
not inside our process.

## Pilot run — 2026-07-19 (indicative, not the official gate)

First end-to-end measurement of the concept-enum mapping. **Not gate-
official**: the corpus is still `gen`-flagged (no real user phrasings for
billing/courier/webhooks yet, per corpus.md), and the FR/RO phrasings are
translated here, not native-user sourced. Recorded as directional evidence.

- **Harness:** for each phrase, a fresh `claude-haiku-4-5` instance sees
  ONLY the concept enum + one-line descriptions (exactly what the MCP tool
  schema exposes) and returns one concept ID. No signatures, no aliases,
  no other context. Deliberately below-spec model (gate spec is
  claude-opus-4-8) — a conservative floor.
- **Corpus:** the 32 canonical naive phrasings × 3 languages (EN, FR, RO) =
  96 picks. RO added with **zero code changes** — the enum carries no
  language, so a new locale is only new test rows.
- **Result:** 96/96 (EN 32/32, FR 32/32, RO 32/32) after one fix.
  First pass was 94/96 — both misses the same phrase in two languages
  ("forgot password email" / "email pentru parolă uitată" → `auth.accounts`
  instead of `courier.messaging`), a genuine concept-boundary ambiguity
  (password-reset is both an auth and a messaging concern), not a
  translation failure — the FR equivalent resolved correctly. Fixed by
  sharpening the `courier.messaging` description to explicitly claim
  password-reset / verification emails and disambiguate against auth.*.
- **Reading:** strong directional support that the enum resolves R2 across
  languages consistently. The residual risk is concept-boundary phrasing,
  addressed by description curation — the same closed-domain lever the plan
  always relied on, now consumed by the model instead of BM25. Still gated
  on the real-phrasing corpus before the number counts.

---

# R3 update (2026-07-19) — co-locate the brain, delete reconciliation

> Appended after researching version-skew patterns. Conclusion: R3 was
> framed as a reconciliation problem ("serve 1.3.0 knowledge that matches
> the user's installed 1.1.0") when the proven pattern is to make skew
> structurally impossible — ship each package's knowledge inside its own
> versioned tarball, the way TypeScript ships `.d.ts`. Don't solve
> reconciliation; remove the thing that needs reconciling.

## The finding

The dominant, decade-proven pattern for version-matched per-package
metadata in the JS ecosystem is **co-location**: `.d.ts` type definitions,
`@types`, `typesVersions`, source maps, ESLint shareable configs — all
ship metadata *inside the package version's tarball*, resolved from
`node_modules`. There is no central registry that must "match" the
installed version, because the metadata travels with the code. The
compiler that reads auth@1.1's types physically cannot get auth@1.3's —
skew is impossible, not merely detected. (Refs: TypeScript publishing /
`typesVersions` docs.)

Our current R3 (`versionCheck` + "refuse loudly on mismatch" in
brain-lib.mjs) is the *reconciliation* framing: a central brain artifact
that must be compared against installed versions and can lag them. That is
exactly the framing co-location eliminates.

## What we already have

The Phase 4.1 pivot (`generate-project-brain.mjs`) already reads
`node_modules/@fonderie/*`, keys off each **installed** version, and
compiles one project-specific file. Cross-package deps are already
`peerDependencies` the generator reads. The only structural gap: the
per-package fragments are pulled from a **central** `signatures/` directory
in the CLI/brain, which must retain every version — that central store is
where skew re-enters.

## Design consequence: two paths, split by whether the package is installed

| Path | Mechanism | Skew |
| --- | --- | --- |
| **Installed** packages (the project brain) | Each package ships its own brain fragment in its tarball (generated at that package's build, like `.d.ts`); `init`/postinstall compiles the project brain from `node_modules` | **Impossible by construction** — fragment version == code version |
| **Discovery** (not-yet-installed) | Central prebuilt "latest" brain via the `brain_query` MCP tool | **Acceptable** — nothing is pinned yet, so "latest" is the correct answer to "which package should I add?" |

- **Move the fragment into the package.** Generate `<pkg>/brain/*.md`
  (signatures + outcomes) at each package's build; ship it in `files`. The
  project-brain compiler reads `node_modules/@fonderie/<pkg>/brain/*`
  instead of a central versioned `signatures/` dir. Central `signatures/`
  stays only as the source for the discovery brain.
- **`refuse-loudly` demotes from primary mechanism to safety net.**
  Co-location makes the mismatch it guards against unreachable on the
  installed path; keep `versionCheck` only as a cheap assertion for the
  discovery server (which serves latest and legitimately can differ).
- **Rolling release is rejected.** Collapsing to one version would remove
  skew by removing versions, but breaks reproducibility, forces users to
  update on our schedule, and kills pinning/rollback/audit — the exact
  needs of the enterprise/compliance audience. Co-location gives
  skew-immunity while keeping semver. (Refs: dependency-pinning best
  practices — The Guild, Google Cloud.)

## Gate change (locked before data)

R3's gate was "at startup, serve the brain matching installed versions;
refuse on mismatch." It becomes a **construction invariant plus one
negative test**:

1. **Construction:** the project brain is compiled solely from
   `node_modules/@fonderie/*/brain/*` — never from a central version store.
   A build that reads central signatures for an *installed* package fails
   the gate.
2. **Negative test:** install a project pinning mixed versions (e.g.
   auth@1.1 + billing@1.1 while the CLI ships "latest"), regenerate, and
   assert every signature block in the project brain equals the installed
   package's shipped fragment byte-for-byte — i.e. the CLI's "latest"
   never leaks onto the installed path.
3. **Discovery unaffected:** `brain_query` for a not-yet-installed package
   still returns latest; `versionCheck` remains only as its advisory
   banner.

Determinism unchanged: fragments are byte-reproducible (no timestamps),
sorted order. "No embeddings, no LLM, one flat artifact per project" still
holds — this only moves *where* the per-package fragment is authored, from
a central dir to the package that owns it.

## Open question (flagged, not yet decided)

Fragment format inside the tarball: ship the generated markdown as-is
(simple, human-readable, larger), or a compact JSON the compiler renders
(smaller tarball, one more build step). Decide at prototype time against
tarball-size and reproducibility, not now.
