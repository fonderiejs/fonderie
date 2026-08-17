# Business Continuity & Disaster Recovery Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Ensure Fonderie can recover data and restore service after a disruption. Covers
production data (Postgres) and the systems needed to operate.

> **Applicability:** production infrastructure is **not yet provisioned**. The
> requirements below are commitments that take effect **at production launch**;
> until then they read as design requirements, not operating controls.

## 2. Policy
### Backups
- Postgres will run with **point-in-time recovery (PITR)** — daily base backup
  plus continuous WAL — on the managed Postgres selected at production launch.
- Backups will be **encrypted** at rest and in transit and retained **30 days**.

### Recovery objectives
- **RPO: minutes (via PITR), once production Postgres is provisioned** — maximum acceptable data loss.
- **RTO: 1 hour** — maximum acceptable time to restore service.

### Tested recovery
- A **restore drill** is performed at least **quarterly**: restore to a scratch
  instance and confirm the app boots (migrations auto-run, so boot is a full
  smoke test). Results are recorded.

### Continuity
- Key-person and single-vendor risks are documented with contingencies:
  Louis Choleski (founder).
- Retention/disposal (below and in the Data Retention Policy) ensures backups do
  not hold data past its policy window.

## 3. Review
Reviewed and exercised at least annually. Enforcement per the Information
Security Policy. Operational detail in `../OPERATIONS.md`.
