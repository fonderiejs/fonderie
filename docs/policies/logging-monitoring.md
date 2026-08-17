# Logging & Monitoring Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Ensure security-relevant events are logged, retained, and monitored so that
misuse and incidents are detected. Covers application and infrastructure logs.

## 2. Policy
### Logging
- The application **already** emits **structured JSON logs** (`@fonderie/logger`)
  with a per-request correlation id and `userId`/`workspaceId` context.
- Logs capture authentication events, authorization failures, admin actions,
  and errors. **Secrets and full PII are never logged.**
- **At production launch**, logs will be shipped to a collector (not yet
  provisioned) and retained **90 days hot, 1 year archived**; log stores will be
  access-controlled and tamper-resistant.

### Monitoring & alerting
Once a collector/alerting stack is in place at production launch, alerts route to
on-call (Louis Choleski, founder) with response times per the Incident Response
Plan. At minimum, alert on:
- repeated auth failures / rate-limit 429s (brute force),
- boot-time `checkProductionReadiness()` errors (weak secret, missing key),
- elevated 5xx rate and unhandled errors,
- database connection errors,
- **audit-log integrity failures** (scheduled `verifyEventChain`).

### Health & availability
- A health endpoint (optionally calling `store.testConnection()`) is wired to an
  **uptime monitor**.

## 3. Review & enforcement
Alert coverage is reviewed quarterly. Enforcement per the Information Security
Policy. See also `../OPERATIONS.md`.
