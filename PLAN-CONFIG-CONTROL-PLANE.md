# Plan: config as the reference control-plane resource

_Scoped 2026-07-25. Build the versioned, event-propagated, admin-managed model
on **`@fonderie/config` first** — prove the pattern end-to-end, then generalize
to a control-plane primitive other admin resources (courier templates, …) reuse.
North star: **Kubernetes/Docker** (namespaces, resourceVersion, rollout undo,
watch, ConfigMap vs Secret). Interface: **management-CLI-first** (the LLM drives
it); the HTTP admin API is the contract, a thin human console is a later lens._

## Why config first
It's the most self-contained resource, it's the literal "manage your module
configuration," and it exposes every primitive the control plane needs. Proving
it here de-risks generalizing to the rest.

## What already exists vs what's new
- ✅ **CRUD** — `setConfigEntry` (upsert) / `getConfigEntry` / `listConfigEntries`
  / `deleteConfigEntry` are already exported.
- ✅ **Multi-env** — `environment` column (`'all'` base + env-specific override,
  resolved in `manager.ts`). Keep as-is; it's our **namespaces**.
- ❌ **Version index, revisions, rollback** — none today (row overwritten; only
  `updated_at`).
- ❌ **Optimistic concurrency** — last-write-wins.
- ❌ **Actor / audit** — no `updated_by`, no audit trail.
- ❌ **Push propagation** — the manager **polls a snapshot every 30s** and never
  touches the (excellent) event bus.
- ❌ **Secret kind** — no masked/encrypted counterpart.
- ❌ **Safe HTTP surface** — `ConfigModule.install` adds no routes.

## 1. Data model (version index + revisions)
- `fonderie_config` (extend): add `version INT NOT NULL DEFAULT 1`,
  `updated_by TEXT`.
- `fonderie_config_revisions` (new): `key, environment, value, version, actor,
  created_at` — append-only history, one row per committed version.
- Write path: read gives `(value, version=N)`; a write commits `N+1`, appends a
  revision, updates the current row. **History is never mutated.**
- **Rollback = roll *forward*** to a past value: "undo to version K" writes a new
  revision `N+1` whose value = revision K's value (k8s `rollout undo` semantics).

## 2. Optimistic concurrency (the version-index rule)
The Confluence/k8s model, no locks:
- Client writes with `ifVersion: N` (the version it read).
- `current == N` → commit `N+1`; **first writer wins**.
- `current != N` → **conflict**, resolved by a **per-resource policy**:
  - **automation (config values, the CLI/LLM writer) → reject-and-retry**
    (409 + current version); the AI re-reads and re-applies. No human draft to
    lose — simplest and always correct. *This is config's default.*
  - **human-authored docs (templates, later) → preserve-both + warn** (save as
    `N+2`, keep both, human reconciles). Same version primitive, different policy.

## 3. Event propagation (dual channel — the key design)
The pg bus is **push-first** (`LISTEN/NOTIFY`, ~ms) + **1s poll floor** +
**durable, at-least-once, per-consumer**. A config write fans out on **two
channels, because they're different problems**:
- **Durable event `config.changed`** (payload: `key, env, version, actor` — never
  the value; never anything for secrets) → **`audit`** (who changed what) and
  **`webhooks`** (external fan-out) consume it once each, guaranteed.
- **Broadcast invalidation** → **every** config manager wakes and **re-reads** its
  snapshot (NOTIFY is wake-only; re-read is staleness-proof). Missing one is
  harmless — the 1s floor catches it. Ordering is safe because a re-delivered
  older `version` is ignored (§2's index doubles as the idempotency guard).
- **Open decision:** the bus exposes only the *durable per-consumer* API; a
  "broadcast/invalidate" mode is needed. Either **add a broadcast subscription to
  `@fonderie/events`** (reusable, preferred) or let config open its own
  `LISTEN/NOTIFY` channel (contained, but a second mechanism).
- Replaces the 30s `setInterval`: manager keeps the poll as a slow floor, adds
  wake-on-broadcast for the fast path.

## 4. Secret kind (ConfigMap vs Secret)
Same lifecycle machinery (§1–3), different **exposure** — separate table + read
path so a masking bug in config physically can't leak secrets:
- `fonderie_secrets` (+ `fonderie_secret_revisions`) — mirrors config's shape.
- **Masked** in every list/get/event/log output (metadata only, never the value).
- **Encryptable at rest** via a pluggable encryptor hook (key from env/KMS).
- **Tighter authz** — a separate admin permission from config.
- **Never** in `config.changed`-style event payloads or logs.
- **No package rename** — `@fonderie/config` stays; it's the runtime-settings
  control plane, config being the non-secret kind (k8s files both under one API
  group).

## 5. Safe HTTP surface + admin auth
Admin-scoped routes (the "safe access"):
`GET/PUT/DELETE /admin/config[/:key]`, `GET /admin/config/:key/revisions`,
`POST /admin/config/:key/rollback` — and `/admin/secrets/*` (masked, tighter).
Every mutation carries the actor and emits `config.changed`.
- **Open decision — admin auth is greenfield** (no admin role today): start with a
  single **bootstrap admin token** (env-issued) for v1, grow into an
  `@fonderie/permissions` admin role. Recommend bootstrap-token first.

## 6. CLI — the LLM interface (management-CLI-first)
Thin client over the admin API (live) with a direct-store path (dev/CI):
- `fonderie config get|set|list|delete|rollback|revisions [--env] [--if-version]`
- `fonderie secret set|list|rollback [--env]` (masked)
- `fonderie config apply <file>` — declarative, diffable, GitOps-able (k8s
  `apply`) — **phase 2**; imperative `set` first.
The lazy skill teaches the *pattern once* (uniform verbs), so low-token holds.

## Phasing (each shippable)
1. **Version index + revisions + rollback + optimistic concurrency** (data model +
   services, config only). The heart of the pattern — no HTTP yet, proven against
   real Postgres.
2. **Event propagation** — durable `config.changed` + broadcast invalidation;
   retire the 30s poll to a floor.
3. **Secret kind** — separate table, masked service, encryptor hook.
4. **HTTP admin surface + bootstrap admin auth.**
5. **CLI management commands** (the LLM interface).
6. **Consumers + generalize** — `audit` + `webhooks` consume `config.changed`;
   lift version/revision/propagation into a shared control-plane primitive the
   other admin resources reuse.

## Open decisions (need a call before building)
1. **Broadcast mode home** — add to `@fonderie/events` (reusable) vs config-local
   `LISTEN/NOTIFY`. *Lean: add to events.*
2. **Admin auth** — bootstrap token vs full permission model for v1. *Lean:
   bootstrap token, grow into permissions.*
3. **Secret encryption provider** — plaintext-in-separate-table + masking for v1,
   or pluggable encryptor from day one. *Lean: masking + pluggable hook (no-op
   default) so encryption can drop in.*
4. **Config conflict default** — confirm reject-and-retry for config values
   (automation). *Lean: yes.*

## What generalizes later (not now)
The version-index + revision + rollback + dual-channel-propagation + audit is a
**control-plane primitive**. Once proven on config, courier templates (with the
*preserve-both* conflict policy) and other admin resources plug into the same
machinery — the `checkReadiness()`/contribution pattern applied to management.
