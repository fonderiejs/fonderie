# SOC 2 readiness — codebase plan

> The engineering work, in this repo, that moves remaining controls from
> *documented / optional* to *enforced / operating*. Everything here is code we
> control. The **non-codebase** work (provision infra, adopt policies, engage an
> auditor, collect evidence over a window) is tracked in
> [`../../SOC2-readiness.md`](../../SOC2-readiness.md) and the policies — it is
> **not** in this plan.

Owner: **Louis Choleski** · Status legend: ☐ todo · ◍ in progress · ✅ done.

**Progress (2026-08-18):** P0 complete; most of P1 merged. Done: A1–A4, B1, B3,
B4, C1, D1, E1–E3, F1. Remaining: A5, B2, C2, C3, D2, D3, E4, F2.
Priority: **P0** unblocks readiness · **P1** expected by auditors · **P2** hardening.

## Scope & boundary
Being "SOC 2 ready" needs three things this plan **cannot** deliver — they're
noted so the boundary is clear:
- **Provisioned production infra** (managed Postgres + PITR, KMS, secrets
  manager, log/monitoring stack). Several tasks below are *ready to switch on*
  but only operate once infra exists.
- **Adopted policies** and **operated controls with evidence over time**.
- **An auditor + evidence platform.**

What this plan *does*: make the product enforce and generate what those controls
need, so that the day infra lands, readiness is a config flip, not a rebuild.

---

## Workstream A — Enforce secure production defaults
Turn today's `◑ warns` into `✅ fails-closed`, so an insecure prod config cannot
boot. Builds on `FonderieApp.checkProductionReadiness()`.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| A1 | Boot gate: in production, `boot()` throws if `checkProductionReadiness()` returns any `error`-severity problem (opt-out via explicit flag) | CC6.1/CC7.2 | App refuses to start on weak/missing secret, malformed key, etc.; test proves it | P0 | ✅ #31 |
| A2 | Escalate `secretEncryptor` absence from warning → **error in production** (config module) | CC6.1 (#1) | Prod boot fails without an at-rest encryptor unless explicitly acknowledged; test | P0 | ✅ #32 |
| A3 | Add `mfaSecretKey` required-in-prod check when MFA is enabled (warn → error) | CC6.1 | Prod + MFA without key fails readiness as error; test | P1 | ✅ #34 |
| A4 | Enforce DB TLS in production: `assertProductionDbConfig` errors (not warns) on `sslmode=disable`/`ssl=false` | CC6.7 | Prod boot fails on plaintext DB transport; test | P1 | ✅ #34 |
| A5 | `secureCookies` defaults to required in production (error if false) | CC6.7 | Test covers the escalation | P2 | ☐ |

## Workstream B — Observability & monitoring
Give operators the signals CC7.2 wants. Code is inert until a collector exists
(infra), but must exist for the collector to consume.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| B1 | Built-in `/healthz` (liveness) and `/readyz` (calls `store.testConnection()` + readiness report) endpoints in core | A1.2/CC7.2 | Endpoints return 200/503 correctly; documented; test | P0 | ✅ #33 |
| B2 | Metrics export (OpenTelemetry or Prometheus): request count/latency, 5xx, auth failures, rate-limit hits | CC7.2 | Counters emitted; a `/metrics` or OTLP exporter is wired; test | P1 | ☐ |
| B3 | Canonical **security-event log** schema (auth success/failure, admin action, permission denial) via a small helper, so alerts key off stable fields | CC7.2 | Events emitted with consistent shape; documented for alerting | P1 | ✅ #51 |
| B4 | `IntegrityCheckJob` — a scheduled runner wrapping `verifyEventChain` that logs/emits a high-severity event on `ok:false` | CC7.2 | Job runnable on an interval; emits alert-worthy signal on tamper; test | P1 | ✅ #41 |

## Workstream C — Data lifecycle (privacy & confidentiality)
Make retention and subject rights complete and automatable.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| C1 | Retention **scheduler** — a first-class job wrapping `purgeEvents` + `purgeSoftDeletedUsers` on a configurable interval (not manual cron) | C1/P4 | Scheduler runs on boot; windows configurable; test | P1 | ✅ #41 |
| C2 | **SAR completeness** — extend `GET /users/export` to include the caller's data across modules (workspaces memberships, billing, customers) via a registration hook | Privacy | Export bundle covers all user-owned data; no secrets; test | P1 | ☐ |
| C3 | **Erasure completeness** — verify hard-delete cascades across every module's tables; add missing `ON DELETE CASCADE` / cleanup | Privacy | A deleted user leaves no residual rows in any package; test | P1 | ✅ |

## Workstream D — Evidence generation
Make audits cheap by producing evidence from the running system.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| D1 | `fonderie security:report` CLI — prints the live control posture (readiness report, enabled controls, versions, config flags) as JSON/markdown | CC4.1 | One command emits a control-status snapshot for evidence | P1 | ✅ #51 |
| D2 | Access-export helper — list DB roles/role-user-workspace grants to feed the access-review register | CC6.2/6.3 | Command outputs current grants; documented in the register | P2 | ☐ |
| D3 | CI job that regenerates the [control matrix](control-matrix.md) "✅ implemented" rows from code markers (guard against drift) | CC4.1 | Matrix status can't silently go stale; CI check | P2 | ✅ |

## Workstream E — Supply chain & CI hardening
Strengthen CC7.1 / CC8.1 beyond today's audit gate + OIDC provenance.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| E1 | Generate and publish an **SBOM** (CycloneDX) with each release | CC7.1 | SBOM attached to releases | P1 | ✅ #51 |
| E2 | Enable **Dependabot** (or Renovate) + GitHub dependency review on PRs | CC7.1 | Config committed; PRs get dependency review | P1 | ✅ #35 |
| E3 | **Secret scanning** in CI (gitleaks) + GitHub push protection | CC6.1 | CI fails on committed secrets; test/fixture | P1 | ✅ #35 |
| E4 | Pin GitHub Actions to commit SHAs; set least-privilege `permissions:` per workflow | CC8.1 | Workflows use pinned actions + minimal perms | P2 | ✅ |

## Workstream F — Assurance
Prove the controls with tests so they don't regress.

| # | Task | Control | Acceptance | Pri | Status |
|---|------|---------|------------|:--:|:--:|
| F1 | Production-config test: `checkProductionReadiness` fails on each insecure setting (matrix of cases) | CC6.1 | One test enumerates all fail-closed cases | P1 | ✅ #41 |
| F2 | Authorization/tenant-isolation test sweep — assert cross-workspace access is denied on every protected route | CC6.1 | Coverage report of authz per route | P2 | ☐ |

---

## Suggested sequence
1. **P0 first (A1, A2, B1)** — fail-closed boot gate, required at-rest encryptor, health endpoints. These make "secure prod config" enforceable and give infra something to hook into.
2. **P1 batch (A3–A4, B2–B4, C1–C3, D1, E1–E3, F1)** — observability, data lifecycle, evidence CLI, supply-chain hardening.
3. **P2** — remaining hardening and drift guards.

Each row is a self-contained PR with tests, mergeable through the protected
`main`. Once A + B land and infra is provisioned, the readiness assessment's
technical section is satisfied.

## Dependencies on non-code work (blockers outside this plan)
- B1–B4 emit signals but need a **collector/alerting stack** to be useful.
- A2/A4 enforce encryption/TLS but need a **KMS + TLS-terminated Postgres**.
- C1 purges on schedule but backup retention is set at the **infra** layer.

See [`../../SOC2-readiness.md`](../../SOC2-readiness.md) for the full picture and
the organizational track.
