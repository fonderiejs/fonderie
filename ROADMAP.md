# Fonderie.js — Roadmap

## Target

> A TypeScript developer, 1–5 person team, building a B2B or B2C SaaS product.
> Does not want to spend 3 months on auth, billing, and plumbing before writing a single line of product code.

The framework's promise: **the first 3 months of every SaaS, already built.**
Register a module, get the endpoints. Own only what makes your product different.

---

## Scope Map

### Foundation
_Runs everything. Invisible to end users._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/core` | Request router, middleware pipeline, module system, shared context types | ✅ Built |
| `@fonderie-js/store` | DB adapter interface, PostgreSQL driver, migration runner, SQL helpers | ✅ Built |
| `@fonderie-js/logger` | Structured logging, log levels, pluggable transports (stdout, file, external) | ⬜ Planned |

---

### Identity & Access
_Who is this person, and what are they allowed to do._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/auth` | Email/password, phone OTP, Google OAuth, stateless JWT sessions, TOTP MFA with backup codes, password recovery | ✅ Built |
| `@fonderie-js/permissions` | Role-based access control, CRUD-bit permissions per resource, `requirePermission` middleware, multi-role BOOL_OR aggregation | ✅ Built |

---

### Collaboration
_Teams, shared context, and controlled access._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/workspaces` | Workspaces, member management, custom roles, token-based invitations, workspace-scoped routes | ✅ Built |

---

### Revenue
_Getting paid._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/billing` | Config-driven plan catalogue, Stripe subscriptions, polymorphic user and workspace billing surfaces, usage metering, webhook handling | ✅ Built |

---

### Communication
_Talking to users._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/courier` | Transactional email, SMS, and push — multi-channel delivery, FS or DB templates, per-message-type channel routing, persistent message log | ✅ Built |
| `@fonderie-js/notifications` | In-app notification centre — per-user feed, read/unread state, type-based filtering | ⬜ Planned |

---

### Observability
_Knowing what is happening in production._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/audit` | Immutable, append-only activity log — who did what, when, on which resource. Feeds compliance evidence. | ⬜ Planned |
| `@fonderie-js/monitoring` | Request latency, error rates, uptime tracking — exposes `/metrics` endpoint (Prometheus-compatible) | ⬜ Planned |

---

### Compliance
_Closing enterprise deals and operating in regulated markets._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/compliance` | SOC2 evidence collection, GDPR data subject requests (export, erasure, consent), data retention policies, PII masking in logs | ⬜ Planned |

> `@fonderie-js/compliance` depends on `@fonderie-js/audit`. Both depend on `@fonderie-js/logger`.
> Separating them lets early-stage products use the audit log without pulling in full compliance machinery.

---

### Infrastructure
_The services every product grows into._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/config` | DB-backed feature flags, per-environment overrides, TTL-based hot reload, typed `getConfig` helper | ✅ Built |
| `@fonderie-js/storage` | File uploads with provider abstraction (S3, R2, local), signed URLs, size and type validation | ⬜ Planned |
| `@fonderie-js/queue` | Background jobs, scheduled tasks, configurable retries, dead-letter handling | ⬜ Planned |
| `@fonderie-js/webhooks` | Outbound webhooks — let customers subscribe their own endpoints to your internal events | ⬜ Planned |

---

### Distribution
_How developers adopt and use Fonderie._

| Package | What it does | Status |
|---|---|---|
| `@fonderie-js/client` | Isomorphic TypeScript client — consumes package DTOs, fully typed, zero runtime dependencies | 🔨 Shell |
| `fonderie` CLI | Scaffold new projects, generate module boilerplate, run migrations, sync plans | ⬜ Planned |
| OpenAPI / Swagger | Auto-generate OpenAPI v3 specs from registered routes and DTOs | ⬜ Planned |

---

## Build Order

Dependencies drive the sequence. Each layer builds on the one below it.

```
1. logger        → foundation for everything that follows
2. audit         → consumes logger; feeds compliance evidence
3. monitoring    → consumes logger; wraps the middleware pipeline
4. compliance    → consumes audit + logger; SOC2, GDPR, retention, PII
5. storage       → self-contained; high demand, low coupling
6. webhooks      → audit events as outbound triggers
7. queue         → benefits from full observability stack already in place
8. notifications → sits on top of queue + audit
9. client        → generated from package DTOs once the ecosystem is stable
10. CLI          → scaffolds against client + all packages
11. OpenAPI      → last mile; auto-generates from the full registered route tree
```

---

## Status Summary

| | Count |
|---|---|
| ✅ Built | 8 |
| 🔨 In progress | 1 |
| ⬜ Planned | 11 |
| **Total** | **20** |
