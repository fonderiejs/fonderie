# Migration plan: `@fonderie` (test) → `@fonderiejs` (product) @ 1.0.0

_Parked 2026-07-22. Execute WHEN VALIDATED — not before. `@fonderie/*` is the
pre-Y-Combinator test scope where we prove things make sense; `@fonderiejs/*` is
the product delivery, launched with every package at a clean **1.0.0**._

## Why a plan, not a script yet

The test scope is doing its job — real benchmarks, real fixes, real npm
publishes. The product launch is a deliberate, one-way event (new scope, version
reset, public URLs). We write it down now so it's a checklist, not a scramble,
and execute once the test scope has proven the product.

## The version reset — the subtlety

"All at 1.0.0" is **not** a changeset bump. Changesets compute from current
versions (mixed 0.1.x and 1.x.x), so a "major" gives `2.0.0` here, `1.0.0`
there — never uniform. The reset is a **deliberate rewrite**: set every
`package.json` `version` to `1.0.0`, drop the accumulated `CHANGELOG.md`s (fresh
history at launch), and start changesets from 1.0.0. One script, reviewed.

## Checklist (in order)

1. **Create the `fonderiejs` npm org** and confirm the publishing account owns
   it (the current E404 on `@fonderiejs/*` is exactly this — the scope doesn't
   exist yet).
2. **Rename every package** `@fonderie/<x>` → `@fonderiejs/<x>` — `name`, and
   every cross-package `peerDependencies`/`devDependencies` reference.
3. **Reset all versions to `1.0.0`**; reset CHANGELOGs; re-init changesets.
4. **Repoint metadata**: `repository.url`, `homepage`, `bugs` (already
   `fonderiejs/sdk` on GitHub — verify), and the git remote/`.gitmodules` in the
   parent crewfinding repo.
5. **Update the CLI + skill data**: `@fonderie/cli` → `@fonderiejs/cli`; the
   generated skill/query text and `data/knowledge.json` reference package names —
   regenerate. The co-located `brain/` fragments key off the scope in
   `node_modules/@fonderiejs/*` — `brain-fragment.mjs` and
   `generate-project-brain.mjs` hard-code `@fonderie`; parameterize the scope.
6. **CI / release**: `release.yml` and the freshness gates reference paths, not
   the scope, so mostly fine — but the provenance `repository.url` must match
   (the same class of bug we hit before: a mismatched org fails sigstore).
7. **First publish of each renamed package is manual** (npm can't create a new
   package name from CI — the E404 rule), then CI owns them.
8. **Deprecate the `@fonderie/*` test packages** on npm pointing at
   `@fonderiejs/*`, so the staging scope doesn't confuse anyone.

## Scope-hard-coding to fix before migration (found while planning)

These assume `@fonderie` literally and must be parameterized (or sed-swept):
- `scripts/brain-fragment.mjs`, `scripts/generate-project-brain.mjs`,
  `scripts/generate-brain.mjs` — `node_modules/@fonderie`, `@fonderie/` filters.
- `packages/cli/bin/fonderie.mjs` — `@fonderie` in `installed()` + query text.
- `experiments/.../run-sequence.sh` — `@fonderie/$p` completion checks.

A single `FONDERIE_SCOPE` constant (default `@fonderie`, set `@fonderiejs` at
migration) would make the switch one line instead of a sweep. Worth doing
*before* launch so the migration is flip-a-flag, not find-and-replace.

## What does NOT move

The architecture, the bricks, the lazy-skill pattern, the benchmarks — all
proven in the test scope, carried over unchanged. Only the name and the version
baseline reset. Same knowledge, product-grade label.
