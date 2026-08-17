# Incident Response Plan

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **[assign — e.g. CTO / Security Officer]** · Approver: **[assign]** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Define how Fonderie detects, responds to, and learns from security incidents —
any event that compromises the confidentiality, integrity, or availability of
Fonderie or customer data.

## 2. Roles
- **Incident Commander (IC)** — [assign]; coordinates the response, makes the call
  on severity and closure.
- **Communications lead** — [assign]; owns customer, internal, and regulator comms.
- **Security Officer** — [assign]; accountable for the process and post-mortem.
- **On-call/pager**: [contact — e.g. pager rotation / security@fonderiejs.com].

## 3. Severity levels
| Sev | Definition | Target response |
|---|---|---|
| **SEV1** | Confirmed breach or major outage; customer data at risk | Immediate, 24/7 |
| **SEV2** | Significant risk, contained or partial impact | Within [1 hour] |
| **SEV3** | Minor/limited, no data exposure | Next business day |

## 4. Process
1. **Detect** — from monitoring alerts (auth failures, integrity check failures,
   5xx spikes), staff reports, or the `SECURITY.md` private-report channel.
2. **Declare & triage** — IC assigns severity, opens an incident record in
   [tracker], starts a timeline.
3. **Contain** — isolate affected systems, revoke credentials, block access.
4. **Eradicate & recover** — remove the cause, restore from clean backups
   (see BC/DR), verify integrity.
5. **Notify** — affected customers and, where applicable, regulators, **within
   72 hours** of confirming a breach involving personal data (or per contract).
6. **Post-mortem** — blameless review within **[5 business days]**; corrective
   actions are tracked to closure.

## 5. Records & testing
Every incident is recorded with timeline, impact, and evidence. A **tabletop
exercise** is run at least **annually**.

## 6. Enforcement
Per the Information Security Policy.
