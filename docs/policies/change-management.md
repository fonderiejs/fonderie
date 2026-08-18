# Change Management & Secure SDLC Policy

> **Status:** ADOPTED — effective 2026-08-18, approved by Louis Choleski (founder,
> acting Security Officer). Reviewed at least annually and on material change.
> Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 1.0 · Effective: **2026-08-18** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Ensure changes to code and infrastructure are reviewed, tested, and traceable,
so nothing reaches production without control. Covers all source repositories
and deployment pipelines.

## 2. Policy
### Source control & review
- All changes are made in **version control** on a branch and merged via **pull
  request**; direct pushes to `main` are blocked by branch protection.
- **CI must pass before merge** — build, typecheck, tests (incl. Postgres/Redis
  concurrency tests), dependency audit, and the validation + signature freshness
  gates.
- Security-sensitive paths (`auth`, `config`, `permissions`, `rate-limit`,
  `.github/workflows`) request a reviewer via **CODEOWNERS**.
- `main` requires a PR and a green CI check; force-pushes and deletion are
  disabled.

### Testing & quality
- Changes include tests; the suite runs in CI on every PR.
- New public API surface regenerates the signature docs (enforced by CI).

### Release integrity
- Releases publish **only from `main`**, via **OIDC Trusted Publishing with
  signed provenance** — no long-lived npm tokens.
- Versioning goes through changesets; the "Version Packages" PR is reviewed.

### Dependencies
- CI **fails on high-severity advisories** in shipped dependencies
  (`npm run audit:ship`). Dependencies are reviewed monthly and on alert.

### Emergency changes
- Expedited changes are permitted for incidents; they still go through a PR and
  are reviewed **retroactively within 1 business day**, with the reason recorded.

## 3. Exceptions & enforcement
Per the Information Security Policy.
