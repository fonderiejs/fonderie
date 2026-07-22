---
"@fonderie/cli": minor
---

Add `fonderie add <recipe>` — deterministically wire a capability in one command: installs the recipe's bricks, emits a version-matched `src/fonderie.ts` composition (matching the maintained `example-express`, verified to typecheck against the installed packages), and sets up `.env.example`. Positioned as a correctness/DX convenience, not a token/turn saving — an auth-session pilot found the wiring isn't the turn bottleneck (experiments/phase41-2026-07/DISCOVERY-ADD-WIRING.md).
