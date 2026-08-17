# Change Management & Secure SDLC Policy

> **Status:** DRAFT stub — not adopted. Fill every `[FILL: …]` and have an
> officer approve before it counts as a control.
> Owner: `[FILL: role]` · Version: 0.1 · Effective: `[FILL: date]` ·
> Review: annually or on material change.

## Policy
- All changes go through version control and a **pull request**; direct pushes
  to `main` are blocked (branch protection).
- **CI must pass** (build, typecheck, tests, dependency audit, validation +
  signature gates) before merge.
- Security-sensitive paths request a reviewer via `CODEOWNERS`.
- Releases publish only from `main`, via OIDC Trusted Publishing with signed
  provenance — no long-lived tokens.
- Dependencies: CI fails on high-severity advisories; review `[FILL: cadence]`.
- Emergency changes are documented and reviewed retroactively within
  `[FILL: window]`.
