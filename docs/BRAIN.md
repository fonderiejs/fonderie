# Keeping the brain fresh

Fonderie's real client is an LLM. If the model's knowledge of the SDK is
stale or wrong, it wires bricks incorrectly and the whole promise breaks. So
the SDK ships a **brain** — a knowledge artifact the agent reads — and the
repo has machinery to keep that brain in lockstep with the actual code.

This doc is how that machinery works and the one habit that keeps it from
biting you.

## What the agent actually reads

The skill lives in `.claude/skills/fonderie/` and is **three roles across a
few files**, with a strict generated-vs-curated split:

| File | Role | Maintained by |
| --- | --- | --- |
| `SKILL.md` | When to reach for which brick; composition rules of thumb | **hand** |
| `API.md` | Curated wiring guide: the golden `buildFonderie()` example, routes, adapter mounts | **hand** |
| `SIGNATURES.md` + `signatures/` | The exact public API of every package | **generated** |
| `brain.json` | The structural knowledge graph (deps + signatures + outcomes + curated layer) | **generated** |
| `brain-knowledge.json` | The curated layer feeding brain.json: aliases, recipes, invariants | **hand** |

The rule: **generated files are never hand-edited, curated files are never
generated.** If you edit a signature by hand it will be overwritten; if you
add a recipe to `brain.json` directly it will be lost on the next build. Put
knowledge in `brain-knowledge.json`, put facts-from-source in the generators.

## How the generated half is built

Two commands, both **zero-LLM** (pure extraction — deterministic and
reviewable):

```sh
npm run docs:signatures   # generate-signatures.mjs + generate-outcomes.mjs
npm run docs:brain        # generate-brain.mjs + generate-cli-data.mjs
```

- `generate-signatures.mjs` walks each package with the **TypeScript
  checker** and emits `SIGNATURES.md` + per-package `signatures/*.md` — exact
  enough that no one reads package source to learn a constructor or config
  shape, compact enough to sit in context.
- `generate-brain.mjs` extracts the structural spine (package.json
  `peerDependencies`, the generated signatures, the `*-outcomes.md`) and
  **fuses** it with the curated `brain-knowledge.json` into `brain.json`.
- `generate-cli-data.mjs` mirrors the curated concepts/recipes/invariants
  into `packages/cli/data/knowledge.json` so the shipped CLI can't drift.

Because everything is extracted from source, the brain is only as fresh as
the last time you ran these — which is why there's a gate.

## The freshness gate (and why CI fails)

CI regenerates the brain and fails if the committed files differ from source:

```sh
npm run docs:signatures && npm run docs:brain && git diff --exit-code
```

If you changed a public surface and didn't regenerate, the diff is non-empty
and CI stops you. This is intentional: it makes "the brain is wrong" a build
failure instead of a silent regression the agent inherits.

`npm run version` also runs `docs:brain`, so the release PR always carries a
fresh brain.

## The two-strike rule

The gate has bitten this project twice, the same way both times: regenerating
one artifact and forgetting the other. Avoid it with one habit — **after any
change to a public surface or curated knowledge, run both and stage
everything the generators touch, before you commit:**

```sh
npm run docs:signatures && npm run docs:brain
git add .claude/ packages/*/brain packages/cli/data/knowledge.json
```

Then commit. If `git diff --exit-code` is clean after that, CI will pass.

## When to touch what

| You changed… | Do this |
| --- | --- |
| A package's public API (a constructor, exported type, route) | `docs:signatures` **and** `docs:brain`, stage, commit |
| How bricks should be *used* together (composition, a recipe, an alias) | edit `brain-knowledge.json`, then `docs:brain`, stage, commit |
| When to reach for a brick, a rule of thumb | edit `SKILL.md` (hand file) — no generation needed |
| The golden wiring example / mounts | edit `API.md` (hand file) — no generation needed |

## How you know it's working

Two ways to check the brain actually helps the agent, not just that it's
fresh:

1. **Retrieval** — `npm run brain:serve` runs the retrieval server over
   `brain.json`; `npm run brain:test` exercises it. This is how an agent
   queries the graph on demand instead of loading it whole.
2. **Outcome** — the token-cost benchmark in [BENCHMARKING.md](BENCHMARKING.md)
   measures whether an agent *with* the skill builds a correct backend for
   fewer tokens than one building from scratch. A fresh brain that doesn't
   move that number isn't earning its place — and the benchmark has, at
   least once, honestly reported the brain *not* beating fat-skill context
   loading for a small task. Keep measuring; don't assume.
