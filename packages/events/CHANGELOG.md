# @fonderie/events

## 5.2.1

### Patch Changes

- 489da10: Forward `consume` and `claimTimeoutMs` from the declarative `{ type: 'pg' }` transport config.
  
  Producer-only mode shipped on `PGTransport`'s constructor, but `resolveTransport` never copied the option across — so `new EventsModule({ transport: { type: 'pg', connectionUrl, consume: false } })` type-checked at the call site and silently did nothing, still opening a LISTEN client and a poll loop. That is the form the examples, the templates and the docs all use, which made the option effectively missing for most apps and left the serverless case it was written for unreachable without dropping down to the class form.
  
  Two tests cover it: one asserts the declarative form actually suppresses the consumer, and one reads this file and asserts every optional key on the `{ type: 'pg' }` union is forwarded inside `resolveTransport` — options declared in one place and forwarded in another drift apart by default, and the type system cannot see the gap.

## 5.2.0

### Minor Changes

- 3f02a51: The durable outbox is now usable from a serverless producer, and a failing queue is no longer invisible.
  
  `PGTransport.start()` bundled four things: connecting the store (needed to publish), resetting orphaned rows, opening a `LISTEN` client, and starting a poll loop that never returns. A serverless API needs only the first — but taking all four means every instance opens a `LISTEN` connection, which a transaction-mode pooler (Supabase's 6543) rejects outright, plus a loop the invocation cannot host. There was no way to say "connect me as a producer", so publishing durably from serverless was impossible. `consume: false` now stops after the store is connected. `drain()` still works in that mode, so a scheduled ping can consume without anything long-running.
  
  `deadLetters()` and `pendingCount()` expose what the outbox knows but nothing surfaced. A dead row is the end of the line — durable, retried, and never to be delivered — yet a queue that has silently stopped delivering looked exactly like one with nothing to do, which is the failure mode an outbox exists to eliminate. Both answer emptily before the transport connects, so a health route can call them unconditionally.
  
  Two remaining detached dispatches are fixed. `LoginEventModel.recordSafe` is now awaitable: it still never throws, but it is a security audit trail (who signed in, from where, from which IP), and a detached write is abandoned when a serverless instance freezes after the response — losing the row entirely rather than merely its IP. Billing's low-balance customer email went through `notifyBilling` rather than the bus, so the earlier sweep did not match it; it has the same exposure and now routes through `background()` too.

### Patch Changes

- f542cfa: Fix two defects in the durable outbox that only appear once something actually consumes it.
  
  `deadLetters()` selected `c.last_error`, but the column the transport writes is `error` — the query throws `column c.last_error does not exist` on any real database. It shipped green because the only thing that catches a wrong column name is a live Postgres: the SQL parses, the types line up, and the unit tests never connect. There is now a test that reads the migration files, collects the columns they create, and asserts every column the transport reads is one of them.
  
  `drain()` reclaimed abandoned work by resetting every row in `processing` to `failed`, copying what `start()` does at boot. That is safe for a single worker starting up and wrong for `drain()`, whose entire purpose is serverless — where instances run it concurrently. Each invocation would take the rows the others were mid-send on and process them again, which for an outbox that sends email means the same message arriving twice. The reset is gone from both paths. Claiming now also picks up `processing` rows older than `claimTimeoutMs` (new, default 5 minutes), inside the existing `FOR UPDATE SKIP LOCKED` claim — so abandoned work still comes back, two consumers racing for the same stale row produce one winner, and recovery no longer requires a restart. Migration `004` adds the `claimed_at` column this needs, backdating any row already stuck in `processing` so the first poll picks it up.
  
  `drain()` also answers emptily before the transport is connected, matching `deadLetters()` and `pendingCount()` — previously it dereferenced an unset store.

## 5.1.0

### Minor Changes

- c63f35b: Notifications, webhooks and domain events are no longer silently dropped on serverless.
  
  Work dispatched off the request path was detached (`bus?.emit(...).catch(() => {})`). On a long-running host that promise finishes in the background; on serverless it does not — the instance is frozen the moment the response is written, so the work is abandoned mid-flight. A registration returned "Account created. Check your email" while the verification email was never sent, and nothing appeared in the logs, because the code that would have reported the failure never ran either. The same applied to payment receipts, dunning notices, low-balance warnings, workspace invitations and customer events.
  
  Core gains `background(work)`, and 43 dispatch sites across auth, billing, customers and workspaces now go through it. Its behaviour is chosen by `FONDERIE_BACKGROUND_TASKS`:
  
  - `auto` (default) — wait on serverless, detach anywhere else
  - `await` — always finish the work before responding
  - `detach` — never wait; only safe where the process outlives the response
  
  Detection is a positive list of serverless markers (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `FUNCTION_TARGET`, `K_SERVICE`, `FUNCTIONS_WORKER_RUNTIME`), never an attempt to recognise a long-running host — there is no reliable signal for "this process outlives the response", so EC2, Docker and bare metal are the fallback and keep today's behaviour exactly. An unrecognised serverless platform is no worse off than before, and can opt in explicitly.
  
  Awaiting is bounded by `FONDERIE_BACKGROUND_TIMEOUT_MS` (default 5000) so a hung provider degrades to lost work rather than a hung request, and rejections are still swallowed — background work must never fail the request that triggered it. `setBackgroundRunner()` lets an adapter or app supply a platform primitive such as Vercel's `waitUntil`, which is strictly better than either mode: the work completes without delaying the response.
  
  Deliberately unchanged: `.catch(() => {})` used for cleanup and compensation inside an already-awaited flow (invoice teardown, orphaned-blob removal) is error swallowing, not detached work, and wrapping it would change its meaning. `LoginEventModel.recordSafe` is also still detached — making it awaitable changes a synchronous signature and its call sites, so it is left for a follow-up.
  
  
  `@fonderie/events` gains `drain()` on the bus and the Postgres transport. `start()` is the right consumer on a host that outlives the request — it `LISTEN`s and delivers immediately — but it never returns, so it cannot be used where the process must. `drain()` is the same work, bounded by `maxMs`, so a scheduled ping consumes the outbox with no long-running process at all.
  
  That is what makes the durable path topology-independent, and it is the difference between mitigating this bug and solving it: producers always write a durable row, and the deployment picks a consumer — `start()` or `drain()` — without either side's code changing. `background()` remains the safety net for apps that register no durable transport; where one exists, the outbox is strictly better, because it survives a crash and retries, which awaiting cannot.

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 5.0.9

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 5.0.8

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 5.0.7

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 5.0.6

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 5.0.5

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 5.0.4

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.0.3

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.0.2

### Patch Changes

- f3656f8: Consolidate three cross-package duplications into shared @fonderie/core primitives (from the consolidation audit).
  
  - **`constantTimeEqual(a, b)`** (new core export) — the one timing-safe compare. Replaces byte-identical copies in auth (MFA/TOTP codes), events (event-log HMAC), courier (SendGrid/Mailgun webhook-signature verification), and core's own admin-token guard. Prevents any copy silently dropping the length-guard or swapping to `===` and reintroducing a per-module timing side-channel.
  - **`secretStrengthProblem` / `PLACEHOLDER_SECRET` / `MIN_SECRET_LENGTH`** (new core exports) — one weak/placeholder-secret denylist. auth's `jwtSecret`/`clientSecret` checks and core's `validateAdminToken` now share it (the two regexes had already drifted by one term). Call-site policy (required vs optional, field name) stays per-module.
  - **`encodeKeysetCursor` / `decodeKeysetCursor`** (new core exports) — one keyset-pagination cursor over `(created_at, id)`. billing's wallet ledger and audit's event log now share it. **Fixes a real bug in `@fonderie/audit`**: its local decode lacked timestamp field-range checks, so a crafted in-shape-but-out-of-range cursor reached the `::timestamptz` cast as a **500**; it now decodes to null (the model drops the keyset predicate and returns the first page) instead of 500ing. audit's opaque cursor wire format changes to the shared one (in-flight cursors restart pagination — acceptable for an opaque cursor).
  
  Behavior-preserving elsewhere (billing's public `encode/decodeLedgerCursor` are kept as aliases; auth also adopts the existing `dateOrEmpty` for session/user timestamps, fixing a latent `''`-for-string-input inconsistency). Adversarially reviewed; no public API removed.
- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.0.1

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0

## 4.0.0

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0

## 2.0.1

### Patch Changes

- 3cdc21c: Republish `@fonderie/events` and `@fonderie/customers` to fix broken `2.0.0` tarballs. Those two were published from an earlier partial release built when `core`/`store` were assumed to be `1.0.0`, so their tarballs shipped **wrong peer ranges** (`@fonderie/core@^1.0.0`, `@fonderie/store@^1.0.0` — but those are `0.2.0`/`0.1.2`, so `npm install` failed with `ERESOLVE`), and `events@2.0.0` also **shipped without its migration SQL** (`dist/migrations/sql` absent → wouldn't boot). The current source is correct (`core@^0.2.0`, `store@^0.1.1`) and a fresh build includes the SQL; this `2.0.1` republish carries the corrected metadata and complete tarballs. No code change.

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0

## 1.0.3

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.0.2

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.0.1

### Patch Changes

- Packaging and DX fixes found by dogfooding a fresh AI-agent install:

  - Every `@fonderie/*/migrations` subpath now actually ships its declared
    `index.d.ts` — the two parallel tsup dts passes raced over `dist/` and the
    migrations declaration was lost on multi-entry packages. Migrations now
    build as a separate sequential pass.
  - The adapters' optional peers are now truly optional: `withWorkspace`,
    `requirePermission`, and `requireFeature` lazy-load
    `@fonderie/workspaces`/`permissions`/`billing` on first request instead of
    statically importing them at module load, with a targeted install error
    when the peer is genuinely missing.
  - `OPERATIONS` and the `Operation` type moved to `@fonderie/core`;
    `@fonderie/permissions` and the adapters re-export them unchanged.

- Updated dependencies
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/store@0.1.0
