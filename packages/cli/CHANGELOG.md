# @fonderie/cli

## 0.2.0

### Minor Changes

- 35e74ed: Add `fonderie add <recipe>` — deterministically wire a capability in one command: installs the recipe's bricks, emits a version-matched `src/fonderie.ts` composition (matching the maintained `example-express`, verified to typecheck against the installed packages), and sets up `.env.example`. Positioned as a correctness/DX convenience, not a token/turn saving — an auth-session pilot found the wiring isn't the turn bottleneck (experiments/phase41-2026-07/DISCOVERY-ADD-WIRING.md).
- 8a9cc2a: Add `@fonderie/cli` — `fonderie init` sets up a lazy skill (router + per-package bodies read on demand) and keeps it fresh via postinstall; `fonderie query` answers what to install for a capability. The N=3-verified lazy pattern, packaged. (First publish is the one-time manual bootstrap per DEPLOYMENT.md; CI owns it after.)

### Patch Changes

- 0529a86: Skill router now states the definition of done — a Fonderie app is done when it typechecks and is wired per recipe; **no database is needed to build** (bricks own their migrations, which run on boot, and their routes are guaranteed by the package). Stops agents from provisioning a Postgres or booting to "check it works" during authoring. Confirmed: a typecheck-clean wired app boots, self-migrates, and serves the brick routes with no hand-written glue (experiments/phase41-2026-07/DECISION-DB-FREE-AUTHORING.md).
