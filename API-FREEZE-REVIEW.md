# API freeze-review (pre-1.0.0)

A read-only pass over the public export surface of every `@fonderie/*` package,
flagging what's costly to change **after** 1.0.0 (a breaking change = major bump +
trust). Launch pre-work item #3 (MIGRATION-FONDERIEJS.md). Verdict: the surface is
in good shape — **3 small, localized breaking-to-fix items**; everything else is
additive, a conscious commitment, or already consistent.

## A. Decide before the freeze (breaking to change later)

> **All three resolved (2026-07-23).** These are breaking changes staged on `main`
> for the 1.0.0 reset (which republishes everything fresh) — deliberately **not**
> released as separate `@fonderie` test-scope major bumps, to avoid cascade churn
> on disposable versions. See the per-item resolutions below.

1. **Constructor order — `CourierModule` is the outlier.** Every other
   store-backed module is `(store, config?, bus?)`:
   `AuthModule(store, config, bus?)`, `WorkspacesModule(store, config?, bus?)`,
   `CustomersModule(store, config?, bus?)`, `WebhooksModule(store, config?, bus?)`,
   `BillingModule(store, config)`, `PermissionsModule(store, config?)`,
   `AuditModule(store)`. But **`CourierModule(config, store?, bus?)`** puts config
   first (store optional — fs templates need no DB). Either reorder to
   `(store?, config, bus?)` for consistency, or keep and *document* why courier is
   special. Changing a constructor post-1.0.0 is breaking → decide now.
   **✅ Resolved — kept, documented as intentional.** Courier's `store` is
   genuinely optional (fs-based templates need no DB), so config-first is a
   deliberate design (store-first would force a required-nullable first param).
   Not a defect; left as-is.

2. **`@fonderie/config` naming.** It's the only module whose class name doesn't
   mirror its package: `export class RemoteConfigModule` in `@fonderie/config`
   (everyone else is `<Package>Module`), and its config is typed
   `IRemoteConfigOptions` — the only one using `Options` instead of the
   `IXConfig` convention. Pick one: rename to `ConfigModule` + `IConfigConfig`
   (consistency), or commit to the "RemoteConfig" concept. Renaming exports is
   breaking → decide now.
   **✅ Resolved — renamed** `RemoteConfigModule` → `ConfigModule`,
   `IRemoteConfigOptions` → `IConfigOptions` (class now mirrors the package).

3. **snake_case leaks in public `@fonderie/events` types.** `IEventRecord` and
   `IConsumerRecord` are exported from `.` with **snake_case** fields —
   `created_at`, `event_id`, `processed_at` — while every DTO everywhere else is
   camelCase (`createdAt`, …). They mirror DB rows (`fonderie_events`,
   `fonderie_event_consumers`). Either camelCase them, or stop exporting the raw
   row types (make them internal). Breaking → decide now.
   **✅ Resolved — camelCased** `IEventRecord.createdAt`,
   `IConsumerRecord.eventId`/`processedAt` (pure type change; nothing read those
   fields internally — DB column names in SQL are unaffected).

## B. Additive — safe to add after 1.0.0 (roadmap, not a blocker)

4. **`routes` config exists only on `auth` + `workspaces`.** The other
   route-registering modules (`billing`, `customers`, `permissions`, `webhooks`,
   `courier`) could gain the same per-route path/method override. Purely additive
   — no need to block 1.0.0; add on demand.

## C. Conscious commitments (not defects — but you're locking them)

5. **Default response envelope `{ reason, explanation, result | details }`.**
   Verbose but consistent across every handler; `onResponse` lets an app remap it.
   1.0.0 commits this as the *default* shape — a deliberate choice worth an
   explicit "yes, this is our contract."
6. **Web-standard `Response` return type + `ctx.meta` as the only inter-package
   channel.** Architectural, sound, and committed. No change.

## D. Verified consistent (no action)

- **`bus?` parameter** varies *correctly* — only event-emitting modules take it;
  `billing`/`permissions`/`audit` publish no events and correctly omit it.
- **Export subpaths** are uniform: `.`, `./types`, `./middleware`, `./migrations`
  (the last, ESM-only by design — a known CJS-compat gap, not a blocker).
- **DTO camelCase** is consistent everywhere except the events row types (A.3).
- **Module class names** mirror their packages everywhere except `config` (A.2).

## E. Out of surface — publishing pipeline (recorded, not an API item)

**✅ Assessed 2026-07-24 — no freeze action.** The drafted move to npm **Trusted
Publishing (OIDC)** (`.github/workflows/release.oidc.yml.draft`;
MIGRATION-FONDERIEJS.md pre-work item 2, option C) was assessed against the
freeze and has **zero public-API impact** — it changes *how CI authenticates to
npm*, not a single export, type, route, or response shape. Nothing here gates or
blocks the 1.0.0 API freeze.

One thing it **preserves** is worth stating, because it's the one consumer-facing
thread the publishing pipeline touches: **npm provenance**. Provenance is the
verifiable "published from this repo + workflow" attestation — the checkable
backing for the project's *audit-everything* promise. Today's `release.yml`
emits it via `NPM_CONFIG_PROVENANCE` + an automation token; the OIDC draft emits
it automatically from the job's id-token. Either way provenance stays **on**, so
the freeze does not lock us out of it and the switch neither adds nor removes a
guarantee consumers rely on.

## Recommendation

**All of section A is now addressed** (config renamed, events camelCased, courier
kept-and-documented) — staged on `main` for the 1.0.0 reset. The rest is additive
or a deliberate commitment, and the publishing-pipeline / OIDC change (E) is
assessed and API-neutral. **The public API is freeze-ready for `@fonderiejs@1.0.0`.**
