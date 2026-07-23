# Migration plan: `@fonderie` (test) → `@fonderiejs` (product) @ 1.0.0

_Parked 2026-07-22. Execute WHEN VALIDATED — not before. `@fonderie/*` is the
pre-Y-Combinator test scope where we prove things make sense; `@fonderiejs/*` is
the product delivery, launched with every package at a clean **1.0.0**._

## Why a plan, not a script yet

The test scope is doing its job — real benchmarks, real fixes, real npm
publishes. The product launch is a deliberate, one-way event (new scope, version
reset, public URLs). We write it down now so it's a checklist, not a scramble,
and execute once the test scope has proven the product.

## Launch scope — two gated events, not one

Treating "launch" as a single migration is why it feels heavy. It's cleaner as
two events with different triggers:

- **A. The 1.0.0 scope migration** — rename `@fonderie`→`@fonderiejs`, reset
  versions to 1.0.0, peer ranges to `^1`, publish under the product scope. A
  ~1-day mechanical execution (the checklist below). **Gate: one real paying
  project live and stable on the SDK** (crewfinding, the first archetype) — i.e.
  "we trust the API enough to call it 1.0.0."
- **B. Public promotion** — landing push, open marketing. **Gate: the fuller
  proof** (the roadmap's 3 clients / $3k MRR). Independent of A; do A the day
  crewfinding goes live without doing B.

**Readiness for A (is the API 1.0.0-worthy?):** contract-fit is proven (25/25
oracle, drop-in with pure config), the SDK installs cleanly with correct peer
ranges, the bricks are audited, cross-agent skill + db-free authoring ship. The
one honest gap is the **1.0.0 stability commitment** — after 1.0.0 a breaking
change costs a major bump and trust, so freeze-review the public API shapes once
before flipping. The business gate (one live paying client) is **not yet tripped**
— crewfinding is in flight.

**Pre-work to do NOW (no gate; makes A flip-a-flag):**
1. ✅ **Done** — parameterized the `@fonderie` scope to a single `SCOPE` constant
   (`scripts/scope.mjs` + the CLI's own const; PR #66). The rename is now a
   one-line flip, verified byte-identical and flip-tested with `FONDERIE_SCOPE`.
2. ✅ **Done** — `@fonderiejs` npm org created under the `fonderie` publishing
   account. *Residual:* if CI publishes with a granular token, mint one scoped to
   `@fonderiejs` too (the current token is `@fonderie`-scoped); a first manual
   publish will confirm end-to-end.
3. Freeze-review the public API surface.

**Recommendation:** don't migrate yet (gate A not tripped); do the pre-work now so
the day crewfinding goes live, A is a one-day flip.

## The version reset — the subtlety

"All at 1.0.0" is **not** a changeset bump. Changesets compute from current
versions (mixed 0.1.x and 1.x.x), so a "major" gives `2.0.0` here, `1.0.0`
there — never uniform. The reset is a **deliberate rewrite**: set every
`package.json` `version` to `1.0.0`, drop the accumulated `CHANGELOG.md`s (fresh
history at launch), and start changesets from 1.0.0. One script, reviewed.

### Peer ranges must tolerate minors (confirmed the hard way, 2026-07-23)

Publishing the `@fonderie` test scope proved the failure mode this reset must
fix. `core` was `0.1.5` and every package pinned it with `peerDependencies:
"@fonderie/core": "^0.1.1"`. Two *additive* core features (a minor bump →
`0.2.0`) fell **out of that `^0.1` range**, so changesets'
`onlyUpdatePeerDependentsWhenOutOfRange` **major-bumped every peer-dependent to
`2.0.0`** — a whole-SDK major release (incl. packages with no real change) off
two backward-compatible additions. In `0.x`, a minor *is* breaking, and a caret
range on a `0.x` peer only accepts patches, so any core feature cascades a major.

At the `1.0.0` reset this stops being a problem **only if the peer ranges are set
right**: with `core` at `1.0.0` and peers at `"@fonderiejs/core": "^1"` (not
`"^1.0.0"` pinned tight — `^1` already spans all `1.x`), a core *minor* (`1.1.0`)
stays in range and does **not** cascade a major. Set every internal
`peerDependencies` range to `^1` at the reset, and audit that no `0.x` internal
peers remain.

## Checklist (in order)

1. ✅ **Done (pre-work)** — the `fonderiejs` npm org is created under the
   `fonderie` publishing account (`choleski@gmx.com`). Before the first publish,
   confirm the CI token is scoped to `@fonderiejs` (mint a new granular token if
   the current one is `@fonderie`-only).
2. **Rename every package** `@fonderie/<x>` → `@fonderiejs/<x>` — `name`, and
   every cross-package `peerDependencies`/`devDependencies` reference.
3. **Reset all versions to `1.0.0`**; reset CHANGELOGs; re-init changesets. **Set
   every internal `peerDependencies` range to `^1`** (see "Peer ranges must
   tolerate minors") so future core changes don't cascade a whole-SDK major.
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
