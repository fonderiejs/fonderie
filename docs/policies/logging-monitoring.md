# Logging & Monitoring Policy

> **Status:** DRAFT stub — not adopted. Fill every `[FILL: …]` and have an
> officer approve before it counts as a control.
> Owner: `[FILL: role]` · Version: 0.1 · Effective: `[FILL: date]` ·
> Review: annually or on material change.

## Policy
- Application emits structured logs (`@fonderie/logger`) with per-request
  correlation ids; shipped to `[FILL: collector]` and retained `[FILL: period]`.
- **Alerting** on: repeated auth failures / rate-limit hits, boot-time readiness
  errors, 5xx spikes, DB connection errors, and audit-integrity failures
  (`verifyEventChain`). See `../OPERATIONS.md`.
- Logs are access-controlled and tamper-resistant; no secrets or full PII in
  logs.
- Alerts route to `[FILL: on-call]`; response times per the Incident Response Plan.
