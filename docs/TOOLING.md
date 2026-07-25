# Tooling

Everything Fonderie ships or runs beyond the bricks themselves: the CLI a
coding agent uses, and the scripts that keep the repo honest. For each,
what it is, why it exists, and when you run it.

## The CLI — `@fonderie/cli`

One binary, zero dependencies, runs in any agent harness. It has two jobs
that look unrelated but share a theme: **let an agent use the SDK without
burning tokens, and let a human drive a live deployment.**

### Teaching an agent the SDK (build-time)

```sh
fonderie init [--project <dir>]     # set up the lazy skill + keep it fresh (postinstall)
fonderie skill [--out <dir>]        # write the lazy skill: a small router + per-package bodies
fonderie query <concept>            # what to install for a capability (e.g. "subscriptions")
fonderie query --concepts           # list every capability the SDK covers
fonderie add <capability>           # deterministically wire a brick: install + compose + migrate + env
```

The point of `skill`/`query`: an agent should learn *which* brick solves a
task and *how to wire it* without loading the whole SDK into context. `add`
goes further — it performs the wiring deterministically (edit the compose
file, run the migration, add the env var) instead of asking the model to
improvise it. Determinism here is both correctness and token savings.

### Driving a live deployment (run-time)

```sh
fonderie config   <get|set|delete|history|rollback> [key] [value]  [--env <e>] [--if-version <n>] [--to-version <n>]
fonderie secret   <get|set|delete|history|rollback|reveal> [key] [value] [--env <e>] ...
fonderie template <get|set|delete|history|rollback> [type] [text]  [--locale <l>] [--subject <s>] [--html <h>] ...
```

These hit the admin API of a running app. Set `FONDERIE_ADMIN_URL` and
`FONDERIE_ADMIN_TOKEN` (and optionally `FONDERIE_ACTOR`); a lost
optimistic-concurrency write returns 409 and the CLI exits non-zero.

**These are deliberately imperative — one key per command.** That is the
token-optimal path: an agent changes one value without materializing the
whole config. We chose *not* to build a k8s-style declarative `apply -f`,
because it forces whole-config loading and a second source of truth — both
hostile to the low-token promise on the agent path. Humans who want a
version-controlled source of truth use git around imperative commands, or
the admin UI.

## The scripts — keeping the repo honest

All live in `scripts/` and run via `npm run …`. Two categories: **generators**
(produce committed artifacts from source) and **guards** (fail CI when
something drifts).

### Generators — regenerate committed knowledge

| Command | Produces | When to run |
| --- | --- | --- |
| `npm run docs:signatures` | `SIGNATURES.md` + `*-outcomes.md` — the exact public API of every package, extracted with the TypeScript checker | after changing any package's public surface |
| `npm run docs:brain` | `brain.json` (knowledge graph) + `packages/cli/data/knowledge.json` | after any surface or knowledge change; also runs inside `npm run version` |

`generate-signatures.mjs` walks each package with the TS compiler and emits a
compact-but-exact signature list, so nobody reads package source to learn a
constructor. `generate-brain.mjs` fuses that structural spine (peer deps +
signatures + outcomes) with the hand-curated knowledge layer into the shipped
`brain.json`. `generate-cli-data.mjs` mirrors the curated concepts/recipes/
invariants into the CLI's data file. All are **zero-LLM** — pure extraction,
so they're deterministic and reviewable. Details in [BRAIN.md](BRAIN.md).

Also present: `generate-project-brain.mjs` (a per-project brain), and
`generate-skill.mjs` (writes the skill files).

### Guards — run in CI, and before you commit

| Command | Checks |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` across all packages (turbo) — the strict type gate; `build` (tsup) is not a substitute |
| `npm run test` | every package's test suite (turbo) |
| `npm run lint` | Biome lint over the whole repo (noisy — includes experiments/skeletons) |
| `npm run lint:ci` | Biome lint over `packages/` at **error** severity — the shipped-code gate CI runs |
| `npm run audit:ship` | `npm audit` at high+ over Fonderie's **shipped** surface (`--omit=dev --omit=peer`) — fails on a real vuln we ship, ignores peer deps the app owns. See [../SECURITY.md](../SECURITY.md) |
| `npm run audit:validation` | every body-taking route either wires `validate()` or is listed as a reasoned exemption in `scripts/audit-validation.mjs` |
| `docs:signatures` + `docs:brain` then `git diff --exit-code` | the committed knowledge is in sync with source (freshness gate) |

The freshness gate is the one that bites: if you change a public surface and
forget to regenerate, CI fails on the diff. The habit that avoids it is in
[BRAIN.md](BRAIN.md#the-two-strike-rule).

### The brain server + tests

| Command | What it is |
| --- | --- |
| `npm run brain:serve` | a retrieval server over `brain.json` — how an agent queries the knowledge graph on demand |
| `npm run brain:test` / `brain:project-test` / `brain:r3-test` | tests for the brain retrieval + project-brain paths |
| `npm run brain:drift` | drift check from the R1 experiment |

## House rules baked into tooling

- **Commits carry no `Co-Authored-By` trailer.** `scripts/strip-coauthors.sh`
  exists for this; keep it that way.
- **Zero runtime deps where it's a promise.** The CLI and client advertise
  zero dependencies — adding one is a product regression, not a convenience.
  Prefer native (`node:` built-ins, JSON over YAML) over a package.
