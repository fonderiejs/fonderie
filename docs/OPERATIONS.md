# Operations — availability, monitoring, change control

Fonderie is a library that runs in **your** process against **your** Postgres,
so the operational controls a SOC 2 auditor expects (backups, monitoring, change
management) are owned by the deploying operator, not the SDK. This runbook is the
documented baseline for SOC 2 findings #7, #8, and #14 in
[`SOC2-readiness.md`](../SOC2-readiness.md). Adapt the specifics to your host.

## Backups & recovery (SOC 2 A1.2 — finding #7)

Fonderie stores everything in Postgres. Back up the database; there is no
separate Fonderie state.

- **Automated backups.** Enable point-in-time recovery (PITR) on your Postgres —
  RDS/Aurora automated backups, Cloud SQL PITR, or `pgBackRest`/`wal-g` if
  self-hosting. Target: daily base backup + continuous WAL, ≥ 7-day retention.
- **Encryption.** Backups encrypted at rest (KMS-managed key) and in transit.
- **Tested restore.** Restore to a scratch instance on a schedule (at least
  quarterly) and confirm the app boots against it — migrations run automatically
  on boot (`MigrationRunner`), so a restore + boot is a full smoke test.
- **RPO/RTO.** Write them down. PITR + WAL gives an RPO of minutes; RTO depends
  on instance size and is what the restore drill measures.
- **Retention & disposal.** Old audit/event rows and soft-deleted users are
  purged with `purgeEvents` / `purgeSoftDeletedUsers` (finding #5) — run them on
  a schedule so backups don't retain data past its policy window.

## Monitoring & alerting (SOC 2 CC7.2 — finding #8)

Fonderie emits structured logs via [`@fonderie/logger`](../packages/logger);
turning them into monitoring is an operator step.

- **Ship the logs.** `@fonderie/logger` writes JSON with a per-request
  `requestId`, plus `userId`/`workspaceId` context. Point its file/console
  transport at your collector (CloudWatch, Loki, Datadog, …).
- **Alert on the security-relevant signals**, which are already logged:
  - repeated auth failures / rate-limit 429s (brute-force) — from the auth +
    rate-limit paths;
  - `checkProductionReadiness()` errors at boot (weak secret, missing key);
  - 5xx rate and error-handler stack traces;
  - DB connection errors (`[store] idle client error`).
- **Health check.** Add a route that returns 200 and, optionally, calls
  `store.testConnection()`; wire it to your uptime monitor.
- **Integrity monitoring (ties to #4).** Schedule `verifyEventChain(store, key)`
  and alert if it reports `ok: false` — that means the audit log was tampered.
- **Metrics.** The SDK does not export Prometheus metrics yet; derive request
  rate/latency from the request logs or your platform's ingress metrics.

## Change management — branch protection (SOC 2 CC8.1 — finding #14)

Release integrity depends on `main` being protected. This is a GitHub
**settings** action (repo admin), not something the repo can enforce itself.

On `fonderiejs/fonderie` → Settings → Branches → add a rule for `main`:

- Require a pull request before merging (≥ 1 approval).
- Require status checks to pass — select the **CI** check.
- Require branches to be up to date before merging.
- Include administrators; restrict who can push.

This makes "only `main` publishes, only via reviewed + CI-green PRs" an enforced
control, not a convention. Pair it with the [`CODEOWNERS`](../.github/CODEOWNERS)
routing (finding #15) so security-sensitive paths always request a reviewer.
