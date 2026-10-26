# Package Audit Prompt

**Purpose:** this is the repeatable prompt for the periodic read-only audit of
`./packages`. Keep it in the repo so every audit runs the same way and its
findings are comparable over time.

Field notes from the first full run (fold these into the prompt when they
stop being true):
- The guards have names — use them: `check:hook-coverage` (three legs: client
  method → hook, backend route → client method, doc hook-identifier → real
  export), `check:hook-parity`, `check:routes`, `check:template-coverage`,
  `check:reasons`, `check:env-declarations`, `check:migration-names`,
  `check:internal-ranges`, `check:evidence`. Propose fixes through these
  before suggesting anything new.
- Guard changes ship with mutation tests (see
  `scripts/check-hook-coverage.test.mjs`): a guard that can't be proven to
  fail on an injected violation isn't a guard.
- Run turbo commands SEQUENTIALLY, never concurrently — concurrent tsup
  clean wipes the shared `dist/`.
- Generated files (`packages/*/brain/*`, `.claude/skills/fonderie/brain.json`,
  `signatures/`, `packages/cli/data/knowledge.json`) are never hand-edited;
  rerun `docs:signatures && docs:brain` and confirm `git diff --exit-code`.
- `~/.npmrc` with an `allow-scripts` line makes npm script runs fail with
  EALLOWSCRIPTS locally; bypass with `--userconfig=/dev/null` and treat CI as
  the real proof.

---

Use the prompt below verbatim (or trimmed) with Claude to audit `./packages`.
It assumes the working directory is the Fonderie repo root.

---

```
You are auditing the `./packages` directory of the Fonderie monorepo (~80 packages).
Your job is a READ-ONLY audit: find and report problems, do not fix anything
unless I explicitly ask. Every finding must cite evidence as `path/file.ts:line`.

## First, load the ground truth

Before judging anything, read these files — they define the principles you
are auditing against:

1. `docs/ARCHITECTURE.md` — the five tiers, the dependency direction
   (everything points toward `core`; never import from a package that depends
   on you), and the core invariants:
   - Bricks never import each other directly; they talk through `ctx.meta`
     and receive interfaces (`IStoreAdapter`, `IBillingProvider`), never
     concrete classes.
   - Self-hosted by construction: nothing may phone home or require a vendor.
   - Application plumbing, never infrastructure (`storage` is not an S3 clone;
     telemetry is not Datadog).
2. `docs/BRAIN.md` — the generated-vs-curated split (generated files never
   hand-edited, curated files never generated) and the two-strike rule.
3. `docs/TOOLING.md` — the scripts that already exist. We do NOT want new
   tooling; the audit must leverage what is already here.
4. `.claude/skills/fonderie/SKILL.md` and `API.md` — the composition rules
   the bricks are supposed to make true.
5. Root `package.json` scripts, `biome.json`, `tsconfig.base.json`,
   `tsup.base.ts` — the shared conventions every package must follow.

## Phase 1 — Run the existing guards (before reading code)

Run each of these and record pass/fail and any output. Do NOT install or add
tools; these are already wired:

- `npm run typecheck`
- `npm run lint:ci`           (Biome at error severity over packages/)
- `npm run test`              (if it is too slow, run per-package on the
                               packages you flag later)
- `npm run audit:validation`
- `npm run audit:ship`
- `npm run check:hook-parity`, `check:hook-coverage`, `check:routes`,
  `check:template-coverage`, `check:reasons`, `check:env-declarations`,
  `check:migration-names`, `check:internal-ranges`, `check:evidence`
- Brain freshness gate: `npm run docs:signatures && npm run docs:brain`
  then `git diff --exit-code` — a dirty diff means the brain is stale.
  Report exactly WHICH generated files drift and which packages they cover.
- `npm run brain:test` (retrieval + completeness)

A failing guard is a finding in itself — but investigate WHY before reporting:
is it a real violation or a stale exemption list?

## Phase 2 — Principle and consistency audit

Work tier by tier (Foundation → Adapters → Capability bricks → Client/CLI →
Frontend mirrors). For each package, check:

### Architecture rules
- **Dependency direction.** Read each package's `package.json` deps and its
  imports. Flag any import that goes against the direction toward `core`,
  and any brick importing another brick's concrete class instead of an
  interface or `ctx.meta`.
- **Cross-brick imports.** Any `@fonderie/*` import between capability bricks
  that isn't declared as a peer dependency is a violation.
- **Zero-dependency promises.** `packages/cli` and `packages/client` advertise
  zero runtime dependencies — flag any addition.
- **Scope discipline.** Flag code in `storage` chasing S3 parity, or anything
  that drags a brick toward infrastructure instead of plumbing.

### KISS / DRY / design-pattern consistency
- **Duplicated logic across packages.** Same helper, validator, middleware,
  or SQL shape implemented independently in 2+ packages instead of living in
  `core`/`store` or being shared intentionally. Distinguish deliberate
  copies (decoupling) from accidental drift — cite both copies.
- **Frontend mirror parity.** The `{react,vue,react-native}-{brick}` and
  `-screens` packages are supposed to be ONE pattern mirrored, not ~45
  decisions. Sample one brick family (e.g. `react-auth`, `vue-auth`,
  `react-native-auth` and their `-screens`) side by side: same hook names,
  same state shapes, same error handling, same pagination style (cursor),
  same file layout? Flag any family that diverges without a documented
  reason. Repeat for at least one more family (billing or workspaces).
- **Adapter parity.** `adapter-express` / `adapter-hono` / `adapter-koa`
  should differ ONLY in framework glue. Diff their structure and flag any
  behavior that exists in one adapter but not the others.
- **Package skeleton consistency.** `src/` layout, `env.json`, `tsup.config.ts`,
  `tsconfig.json` extending `tsconfig.base.json`, migrations structure,
  LICENSE, README. Flag outliers.
- **KISS.** Flag over-engineering: abstractions with a single implementation,
  config options nothing uses, deep indirection where the direct code would
  be shorter and clearer. Be conservative — only report where the simpler
  form is obvious.

### Brain freshness per package
For a sample of at least: `core`, `auth`, `billing`, `workspaces`, `courier`,
`config`, `admin`, `client`, one adapter, and one full frontend family:
- Compare `packages/<pkg>/brain/signatures.md` and `outcomes.md` against the
  package's actual `src/` public exports, routes, and migrations. Flag
  anything in source missing from the brain, or in the brain no longer in
  source.
- Check `.claude/skills/fonderie/signatures/<pkg>.md` and
  `signatures/<pkg>-outcomes.md` tell the same story.
- Check `brain-knowledge.json` (curated aliases/recipes/invariants) still
  matches reality — e.g. a recipe that wires a route that no longer exists.
- Reminder of the rule: generated files must never be hand-edited. If a
  generated file contains content the generators would never emit, flag it
  as hand-tampering.

### Documentation relevance
- Each audited package's `README.md`: does the quickstart still match the
  real API (cross-check against the generated signatures)? Flag stale
  examples.
- Root `docs/*.md` that describe per-package behavior: spot-check claims
  against code. Flag docs describing removed or renamed behavior.
- Flag MISSING documentation only where it matters: a capability brick with
  no README or no outcomes file.

## Phase 3 — Report

Produce a single report with this structure:

1. **Guard results table** — every Phase 1 command: pass/fail, one-line cause.
2. **Findings**, grouped by category (Architecture / DRY / KISS / Mirror
   parity / Brain freshness / Documentation), each with:
   - Severity: `critical` (breaks a core invariant or ships a real bug),
     `major` (inconsistency that will spread or mislead the agent),
     `minor` (style/cleanup).
   - Evidence: `path:line` for every claim, both copies for duplication.
   - Why it violates a stated principle (quote the principle).
   - Suggested fix direction — one sentence, no code.
3. **What is consistently GOOD** — patterns worth keeping, so the fix pass
   doesn't flatten deliberate design.
4. **Recommended fix order** — what to do first and why, reusing existing
   tooling (`docs:signatures`, `docs:brain`, biome, the check:* scripts)
   rather than proposing anything new.

## Hard rules for you (the auditor)

- NEVER edit files, install packages, or run code generation that mutates
  the repo. The only exception is the freshness-gate regeneration in Phase 1;
  if it dirties the tree, capture the diff and run `git checkout -- .` after
  reporting.
- Do not propose new tooling, new dependencies, or new CI steps. If a gap
  exists, phrase the fix in terms of the scripts in `docs/TOOLING.md`.
- Every claim needs a citation. No "this looks like it might…" without
  checking.
- Prefer breadth-first across tiers over exhaustively reading one package;
  where you sample, say so explicitly and name what you sampled.
```
