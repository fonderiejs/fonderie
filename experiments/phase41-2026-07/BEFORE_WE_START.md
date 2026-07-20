# Before we start — Phase 4.1 pre-flight

Do these before spending the ~$30–60 full batch. Each one, if skipped, either
**invalidates** the verdict or **pollutes** the token comparison. `analyze.mjs`
already refuses a verdict while any blocker stands, so an un-prepped batch just
burns money for an INSUFFICIENT.

Ordered by how much it hurts to skip.

## 1. Quality scoring — TOOLING BUILT; scoring still to be done per session

The decision rule is "pb overhead ≤ ⅓ of fat **at equal quality**." Without a
quality score a cheaper condition that ships worse code reads as a win — so
`analyze.mjs` returns INSUFFICIENT until every session is scored.

- **Built:** `CHECKLISTS.md` — 4 per-session rubrics (auth 12 / billing 9 /
  teams 9 / security 9), ASVS-anchored, reusing the token-cost + multi-module
  rubrics; only billing is new. `score.mjs` records a hand score into
  `meta.json` (`checklist_pass`/`checklist_total`) + an audit line in
  `SCORES.md`. `analyze.mjs` reads them and enforces the floor.
- **Floor:** `pass ≥ total − 1` per session (the multi-session generalization
  of ≥ 11/12). A below-floor cell is disqualified from the cost comparison.
- **Still to do (during the run, not after):** actually score each session's
  `src/` — `node score.mjs <run-id> <pass>/<total> ["notes"]` — while the app
  is in front of you. Scoring 36 transcripts weeks later is unreliable.

## 2. Environment stability — HIGH (Docker Postgres now available)

`fat-1-s1`'s own transcript: *"Docker's host port-forwarding is broken… installing
a native Postgres via Homebrew."* That session burned turns fighting infra —
noise, not signal, and it varies per session, inflating variance **unequally**
across conditions and corrupting the token comparison.

- **Do:** stand up ONE stable Postgres before the batch and point every session
  at it via a fixed connection string, so all conditions face identical infra.
  **Docker access is now available** — spin up e.g.
  `docker run -d --name fonderie-bench-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`
  and export the URL the skeletons expect. (Ask the operator to start it; the
  harness should assume it is already up, never provision per session.)
- **Alternative:** stub verification to a fixed harness so DB effort is constant
  across conditions. Either way the goal is: **equal, quiet infra for all runs.**

## 3. Confirm `pb` actually triggers the brain — HIGH (fold into the pilot)

In `pb`, discovery of not-yet-installed capabilities (sessions 2–4) depends on
the model calling `brain_query`. If it improvises or reads files instead, the pb
overhead is polluted *and* quality drops — a silently broken pb.

- **Do:** the 2-session pilot must be `pb` **sessions 1 → 2** (session 1 = auth is
  already installed → no discovery; session 2 = billing is the first discovery
  moment). After it, assert `results/pb-<seq>-s2.brain.log` is **non-empty**.
- Pairs with a `fat` 1 → 2 pilot for the first real pb/fat ratio via `analyze.mjs`.

## 4. Verify `pb` installs like a real user — CONFIRMED ✓

Checked: `token-cost-2026-07/skeleton-b` has **no `.npmrc`** and no `file:` /
`workspace:` links in `package.json` (`@fonderie/core: ^0.1.2` etc.), so a
session's `npm install @fonderie/*` resolves from the **npm registry** — the
real published packages with co-located fragments. The `pb` brain therefore
reflects what ships. No action needed.

## Readiness gate

Do **not** launch the full 36-session batch until:

- [x] #1 quality tooling in place (CHECKLISTS.md + score.mjs; `analyze.mjs`
      enforces the floor) — scoring still to be *done* per session during the run
- [ ] #2 one stable Postgres up, all sessions pointed at it (Docker ready)
- [ ] #3 pilot run `pb` 1→2 + `fat` 1→2, `brain.log` non-empty, `analyze.mjs` clean
- [x] #4 install path confirmed — installs from npm

Then: `./stage41.sh` (resumable) → `node analyze.mjs` → decision per the locked
pre-registration in `BRAIN_PLAN.md § Phase 4.1`. A gate that fails twice ends
the phase; the rule is not renegotiated.
