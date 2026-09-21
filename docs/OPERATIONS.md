# Operations — availability, monitoring, change control

Fonderie is a library that runs in **your** process against **your** Postgres,
so the operational controls a SOC 2 auditor expects (backups, monitoring, change
management) are owned by the deploying operator, not the SDK. This runbook is the
documented operational baseline. Adapt the specifics to your host.

## Backups & recovery (SOC 2 A1.2)

Fonderie stores everything in Postgres. Back up the database; there is no
separate Fonderie state.

- **Automated backups.** Enable point-in-time recovery (PITR) on your Postgres —
  RDS/Aurora automated backups, Cloud SQL PITR, or `pgBackRest`/`wal-g` if
  self-hosting. Target: daily base backup + continuous WAL, ≥ 7-day retention.
- **Encryption.** Backups encrypted at rest (KMS-managed key) and in transit.
- **Tested restore.** Restore to a scratch instance on a schedule (at least
  quarterly) and confirm the app boots against it. **Migrations do not run at
  boot** on any target (see [DEPLOYMENT.md](../examples/DEPLOYMENT.md)) — run
  `npm run migrate` against the restored database as part of the drill, or the
  boot succeeds against a schema that is behind the code and the drill proves
  less than it appears to.
- **RPO/RTO.** Write them down. PITR + WAL gives an RPO of minutes; RTO depends
  on instance size and is what the restore drill measures.
- **Retention & disposal.** Old audit/event rows and soft-deleted users are
  purged with `purgeEvents` / `purgeSoftDeletedUsers` — run them on
  a schedule so backups don't retain data past its policy window.

## Monitoring & alerting (SOC 2 CC7.2)

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

## Reconciling what you declare against what actually holds it

An app configured against an external service holds a *copy* of something that
service owns — a price, a webhook registration, a subscription's status, a
schema version, a DNS record. Copies drift, and this class of drift is unusually
hard to see: both sides stay internally consistent, so nothing errors and nothing
logs. The only symptom is behaviour quietly going missing.

None of these can live in a module's `checkReadiness()`, which is **synchronous**
— reading the other side is a network or I/O call. They are plain async functions
you call at boot or from a scheduled ops route, and every one of them is
non-throwing: a diagnostic must not take down the thing it diagnoses.

| Check | Ours | Theirs | What silence looks like otherwise |
|---|---|---|---|
| `checkWebhookRegistration` (`@fonderie/billing`) | the events we handle | what the provider was told to send, **and the API version the endpoint renders them in** | a handler that can never run; or payloads shaped for a different version parsing to `null` |
| `checkPriceConsistency` (`@fonderie/billing`) | the catalog's amounts | the provider's prices | the same item costing different amounts depending on the purchase path |
| `checkSubscriptionDrift` (`@fonderie/billing`) | `fonderie_subscriptions` | the provider's subscriptions | a cancelled subscriber still served, or a paying one locked out |
| `MigrationRunner.pending()` (`@fonderie/store`) | the schema the code expects | what the database applied | a queue that will not drain, a callback that hangs — never mentioning migrations |
| `checkSenderDns` (`@fonderie/courier`) | the `from` address | the domain's SPF/DKIM/DMARC | mail accepted by the provider and dropped by the receiver |

Each has a `describe…Problems(report)` companion that renders one log line per
finding, so an app can log them uniformly.

**Two rules that decide whether these get read or muted.**

*Report, do not repair.* Every one of these is read-only. Correcting the drift
changes who is billed or who is served, and that belongs to the app as a
deliberate act — not to a cron as a side effect.

*Keep `ok` for hard failures.* Findings that are legitimate-but-notable are
reported without flipping `ok`: a webhook endpoint on a different API version
still delivers, a `p=none` DMARC policy is a real monitoring stage, a renewal
date that moved by seconds is a provider nudging its own clock. Folding those
into `ok` leaves a healthy deployment permanently red, which is precisely how an
alarm stops being read.

A worked example wiring all five onto one route is in
[`examples/leadeasygen`](../examples/leadeasygen/microservices/api/src/fonderie.ts).
With [`@fonderie/admin`](../packages/admin) installed they need no wiring:
each brick describes its checks and `GET /_admin/doctor` runs them, with
`GET /_admin` as the attention page. Pending migrations, which no brick owns,
go in `AdminModule({ checks })`.

## Change management — branch protection (SOC 2 CC8.1)

Release integrity depends on `main` being protected. This is a GitHub
**settings** action (repo admin), not something the repo can enforce itself.

On `fonderiejs/fonderie` → Settings → Branches → add a rule for `main`:

- Require a pull request before merging (≥ 1 approval).
- Require status checks to pass — select the **CI** check.
- Require branches to be up to date before merging.
- Include administrators; restrict who can push.

This makes "only `main` publishes, only via reviewed + CI-green PRs" an enforced
control, not a convention. Pair it with the [`CODEOWNERS`](../.github/CODEOWNERS)
routing so security-sensitive paths always request a reviewer.
