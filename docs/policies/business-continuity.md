# Business Continuity & Disaster Recovery Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **[assign — e.g. CTO / Security Officer]** · Approver: **[assign]** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Ensure Fonderie can recover data and restore service after a disruption. Covers
production data (Postgres) and the systems needed to operate.

## 2. Policy
### Backups
- Postgres runs with **point-in-time recovery (PITR)** — daily base backup plus
  continuous WAL — via **[provider — e.g. RDS automated backups / Cloud SQL]**.
- Backups are **encrypted** at rest and in transit and retained **[30 days]**.

### Recovery objectives
- **RPO: [minutes with PITR / 24h]** — maximum acceptable data loss.
- **RTO: [e.g. 4 hours]** — maximum acceptable time to restore service.

### Tested recovery
- A **restore drill** is performed at least **quarterly**: restore to a scratch
  instance and confirm the app boots (migrations auto-run, so boot is a full
  smoke test). Results are recorded.

### Continuity
- Key-person and single-vendor risks are documented with contingencies:
  [assign].
- Retention/disposal (below and in the Data Retention Policy) ensures backups do
  not hold data past its policy window.

## 3. Review
Reviewed and exercised at least annually. Enforcement per the Information
Security Policy. Operational detail in `../OPERATIONS.md`.
