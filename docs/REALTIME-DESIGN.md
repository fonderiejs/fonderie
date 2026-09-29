# Realtime delivery to frontends — design

**Status:** problem statement + audit + proposed architecture (2026-09-29). Nothing built.

---

## 1. The issue

An operator changes a value in the admin console, and every open app should
reflect it **immediately** — no release, no restart, no waiting for a poll.

The case that surfaced it: a consumer mobile app gates each of its ~35
signed-in screens behind a public remote-config key (`WITH_<NAME>_SCREEN`);
setting a key to `false` in the console turns that screen into a "coming soon"
message. Operators expect the switch to take effect on devices that are open
right now. It does not:

| Hop | Today | Delay |
|---|---|---|
| Console write → other API instances | `ConfigModule` polls its table every `ttl` (30 s in that app); `LISTEN` push exists but needs a long-lived session connection (`connectionUrl`), which a serverless host with a transaction pooler cannot hold | up to 30 s |
| API → device | `useRemoteConfig` loads once; the app refreshes every 5 min and on return to the foreground | up to 5 min |

The workaround the app tried shows why pulling cannot fix it:

- **Re-check on every screen focus, render after the answer.** Correct, but
  every visit to such a screen waits a round trip behind a spinner, tab screens
  re-mount on each focus (scroll and unsaved input lost), and it still returns
  a value up to 30 s stale from the server. Applying it to every screen would
  put a network wait in front of every navigation.
- **Poll faster.** Load and battery grow with open apps × frequency, and the
  30 s server-side floor remains.

What is actually wanted is a **push**: the server tells open apps "something
you care about changed" the moment it is written, and the app, which already
re-renders on a new config snapshot, updates every screen in place. No
per-screen awaits, no spinners.

The same need exists beyond config — a job assigned to a crew, a member
invited, a payment settled — so the mechanism should not be config-specific:
a client should be able to subscribe to **all** events it is allowed to see,
or to **individual** ones.

### Why not webhooks

Webhooks are server-to-server: the receiver must expose a public HTTPS URL. A
phone has none, and would be offline or suspended most of the time anyway.
Webhooks stay the answer for pushing to *other servers*; this is the
equivalent for *clients that hold a connection open*.

### Why SSE (and not WebSockets or mobile push)

- **Server-Sent Events** are one-way (server → client), plain HTTP, pass
  through proxies and CDNs as a normal response, carry a normal `Authorization`
  header from native clients, and have reconnect-with-resume built into the
  protocol (`Last-Event-ID`). One-way is all this needs.
- **WebSockets** add a second protocol and upgrade handling for a
  bidirectional channel nothing here uses.
- **APNs/FCM push** reaches a backgrounded app, but silent pushes are
  throttled and not guaranteed by the OS. It is a later complement for
  background wake-ups, not the foreground channel.

On iOS the OS suspends sockets when the app leaves the foreground. That is
acceptable: a live connection matters while someone is looking at the app;
on resume the existing foreground refresh catches up, then the stream
reconnects.

---

## 2. Audit — what exists, what it lacks

Three read-only sweeps (events + config; webhooks + auth/workspaces/permissions;
core + adapters + client). Evidence is file:line in the repo at the time of
writing.

### 2.1 The trigger exists (config)

- Every config write already sends a Postgres `NOTIFY` on
  `fonderie_config_changed`, **inside the write transaction** (so it fires at
  commit), payload = the environment: `store/src/versioned.ts:150` (write) and
  `:203` (rollback); channel set at `config/src/services/config.ts:66`.
  Secrets use `fonderie_secrets_changed` (`services/secrets.ts:24`).
- `RemoteConfigManager` LISTENs on it when `connectionUrl` is set and does a
  full refresh (`config/src/manager.ts:42-47`); otherwise a 30 s poll floor
  (`:24, 30-38`).
- Gaps: **delete sends no NOTIFY** (`services/config.ts:165-175`, reached from
  `DELETE /admin/config/:key`); the manager has **no change callback and no
  diff** (it replaces the snapshot wholesale, `manager.ts:88-131`); config
  emits nothing on the events bus.

### 2.2 The bus cannot broadcast (events)

- `PGTransport` is a **durable outbox with exclusive claiming per consumer
  name** (`FOR UPDATE SKIP LOCKED`, `events/src/transports/pg.ts:367-400`). N
  instances sharing a consumer name *split* events; they do not each get a
  copy. Consumer rows are only created for subscriptions registered in the
  **publishing** process (`pg.ts:125-133, 440-446`).
- No `off()`/unsubscribe; subscriptions are append-only (`bus.ts:22-24`).
- `IEventMeta` has **no tenant/user scope** (`events/src/types.ts:1-7`); scope
  lives in payloads, inconsistently: customers always carry `workspaceId`;
  billing only for workspace subscribers (`billing/src/utils.ts:14-23`); auth
  carries `userId`; `fonderie.notification.send` carries neither — and its
  `data` holds **PINs, OTPs and reset tokens** (`auth.controller.ts:124,209,528`).
  "Subscribe to all" can therefore never mean "the raw bus".
- `matchesPattern` escapes only `.`; other regex metacharacters in a pattern
  are live regex, and `*` spans segments (`transports/pattern.ts:2-8`). Client
  topic strings must never reach it unescaped.

### 2.3 The subscription model worth copying (webhooks)

- An endpoint holds `events: string[]`; **empty = all**, otherwise exact names
  (`webhooks/src/models/endpoint.model.ts:84-91`).
- It taps the bus once at `'*'` (`webhooks/src/module.ts:29-35`) and **drops
  any event without a string `payload.workspaceId`** (`dispatcher.ts:35-37`) —
  the only authorization precedent for "who may receive an event".
- **No event catalog exists anywhere.** Names live in per-brick `EVENT_KEYS`
  constants (auth, billing, customers, workspaces); webhooks' UI is a free-text
  comma-separated box (`react-webhooks-screens/.../WebhooksListScreen.tsx:71-76`).

### 2.4 Auth on a long-lived request

- `withSession` validates once at request start (JWT `type: access`, session
  alive, user not suspended/deleted — `auth/src/middlewares/session.ts:22-40`);
  nothing re-checks mid-stream. Access tokens live 24 h by default
  (`auth/src/services/jwt.ts:63`). A stream must re-validate on a timer and
  close so the client reconnects with a fresh token.
- Workspace comes from `withWorkspace` (param → `X-Workspace-ID` → personal),
  membership checked only when `ctx.user` is set — so the chain is
  `requireAuth → withWorkspace` (`workspaces/src/middlewares/workspace-context.ts:17-44`).
- Native clients can send `Authorization: Bearer`; a browser `EventSource`
  cannot set headers (cookie `access_token` is accepted, `session.ts:58-67`).

### 2.5 The stack does not stream (core, adapters, client)

- Core's pipeline passes a streaming body through untouched (security headers
  and CORS re-wrap `response.body`; `onResponse` skips non-JSON,
  `core/src/app.ts:479-495`).
- But **three of four transports buffer the whole response**: core `listen()`
  (`res.end(Buffer.from(await response.arrayBuffer()))`, `app.ts:181`), Express
  (`adapter-express/src/index.ts:104`), Koa (`adapter-koa/src/index.ts:165`).
  An endless SSE body would never send a byte. **Hono** returns the Web
  Response untouched (`adapter-hono/src/index.ts:220-233`).
- **Client disconnect never reaches a handler**: `listen()`, Express and Koa
  build `new Request(...)` without a `signal`; the body parser's rebuilt
  request drops it too (`body-parser.ts:95-101`).
- A throw inside a stream after headers are sent bypasses
  `defaultErrorHandler`; the logger records the request as finished at
  headers time.
- `@fonderie/client` is JSON-only: `exec()` forces a JSON content type and
  `res.json()` (`client/src/http.ts:126-158`); no streaming path, no
  `AbortSignal`, no injectable `fetch`. `ConfigClient.set()` → listeners
  (`client/src/modules/config.ts:72-85`) is exactly where pushed changes
  should land: `useRemoteConfig`/`useFlag` would update with no hook change.
- `examples/DEPLOYMENT.md` already says serverless functions are time-limited
  and frozen after responding, and that LISTEN needs a session connection
  (`:60, 151-174`) — so a stream endpoint is long-running-host work.

### 2.6 Found on the way (independent of this feature)

| # | Where | Finding |
|---|---|---|
| R1 ✅ fixed (webhooks 6.0.0) | webhooks | No route mounts `withWorkspace`, yet every handler requires `ctx.workspace` → 422 `MISSING_WORKSPACE` unless the app mounts it globally; route tests only collect routes (`webhooks/src/routes.ts`, `__tests__/smoke.test.ts:661`) |
| R2 ✅ fixed (webhooks 6.0.0) | webhooks | No role/permission check: any workspace member can create, edit, delete endpoints and read the secret returned on create |
| R3 | config | `deleteConfigEntry` sends no NOTIFY — a delete reaches other instances only on the poll |
| R4 | events | `matchesPattern` leaves regex metacharacters live |
| R5 | auth | `fonderie.user.email_verified` and `.password_changed` are declared in `EVENT_KEYS` but never emitted |

---

## 3. Which package — the decision

| Candidate | Fit | Why not (or why) |
|---|---|---|
| `@fonderie/config` | Owns the first trigger | Too narrow: the ask is "all or individual **events**", not only config. Would duplicate everything the second topic needs. |
| `@fonderie/events` | Owns event names and the log | Its semantics are the opposite (durable, exclusive, internal, unscoped). Client authorization would pull workspaces/permissions into the lowest brick everything depends on. |
| `@fonderie/webhooks` | Same idea, server-to-server | Different contract (durable retries, signing, stored endpoints per workspace) and a misleading name for a client stream. It should *share* the catalog and the filter rule, not host the stream. |
| `@fonderie/core` | Framework plumbing | Right home for the **transport** (`sseResponse()`, streaming adapters, abort signal) — wrong home for topics, catalog and authorization. |
| **New `@fonderie/realtime`** | Client-facing fan-out | **Chosen.** One job: deliver allow-listed, scoped events to connected clients. Second demand is met (public config in two apps + the general "all or individual events" ask). |

So the work splits along existing lines:

| Package | Adds |
|---|---|
| `@fonderie/core` | `sseResponse()` helper (headers, heartbeats, `retry`, `id`, abort cleanup, in-stream error handling); `listen()` streams; `ctx.request.signal` survives the body parser |
| `adapter-express`, `adapter-koa` | Stream Web Response bodies; abort on `close`; `drainQueue` not tied to `finish` for streams |
| `@fonderie/core` (types) | `describeEvents?()` — an optional module method next to `describeAdmin?()` / `checkReadiness?()`, plus the `IEventCatalogEntry` type. Every brick already depends on core |
| `@fonderie/events` | Escaped topic matching (fixes R4). **No new API** |
| `@fonderie/config` | Declares `fonderie.config.changed` via `describeEvents()`, sourced from its existing NOTIFY channel; NOTIFY on delete. **No events dependency** |
| **`@fonderie/realtime`** (new) | Catalog enforcement, per-connection subscriptions, audience check, cross-instance fan-out, the `/realtime/stream` route. **Requires `core` only**; `pg` optional via `@fonderie/realtime/pg` |
| `@fonderie/client` | `client.realtime.subscribe(topics, onEvent)` with a pluggable streaming transport; `client.config.watch()`; `pause()`/`resume()` |
| `@fonderie/react` | `useRealtime(topics, handler)`; `useRemoteConfig` uses `watch()` when available, polls otherwise. **No react-native import** — the app calls `pause()`/`resume()` from `AppState` |
| `@fonderie/webhooks` | Later: reads the same `describeEvents()` catalog for its picker. **No new dependency** |

### 3.1 Dependency budget

The design adds **one package with one required edge — `realtime → core` —
and no edge between existing packages** (`pg` is an optional peer, below). Everything else is composed by
the app or matched by shape:

| Need | Would have imported | Instead |
|---|---|---|
| Who is the user | `@fonderie/auth` | `ctx.user`, set by the app's session middleware (core type) |
| Which workspace, is it a member | `@fonderie/workspaces` | `ctx.workspace`, set by `withWorkspace` the app mounts before the route (it already verifies membership) |
| Manager / permission audiences | `@fonderie/permissions` | Not built in. `audience: (ctx, scope) => boolean` hook, so the app plugs `can()` or `requireManager` itself |
| Session revoked mid-stream | `@fonderie/auth` (`aliveBySid`) | A **maximum connection lifetime** (default 15 min, never past the token's `exp`): the reconnect re-runs the app's full middleware chain |
| Receive domain events | `@fonderie/events` | A bus accepted **by shape** — `{ on(type, handler, consumer) }` — passed in by the app; no import |
| Receive config changes | `config → events` | A catalog entry whose source is a Postgres NOTIFY channel (`fonderie_config_changed`); realtime LISTENs to channels its catalog names |
| Replay after reconnect | `fonderie_events` table (events' schema) | Not in v1: on reconnect the server sends `fonderie.stream.reset` and the client refetches. Payloads are invalidations, so refetching is equivalent |
| Pause in background | `react-native` in `@fonderie/react` | `client.realtime.pause()/resume()`, called from the app's `AppState` handler |
| Catalog type shared with webhooks | `@fonderie/events` | Lives in core, next to `describeAdmin` |

**Fan-out is an interface, so even `pg` is optional.** `IBroadcaster` =
`{ publish(ref), subscribe(onRef) }`. The default in-process broadcaster (one
host, tests) needs nothing; `PgBroadcaster` (LISTEN/NOTIFY across hosts) ships
at `@fonderie/realtime/pg` with `pg` as an **optional** peer — the same pattern
as `@fonderie/storage/s3`. Required edges: **`realtime → core`, nothing else.**

Trade-offs this buys: the `manager` audience becomes app-supplied; revocation
takes effect within the lifetime bound instead of 60 s; replay is deferred.
All three can be added later **inside** realtime without new edges.

---

## 4. Architecture (proposal — for revision)

### 4.1 The flow

```
 PRODUCERS (any API instance, serverless is fine)
 ─────────────────────────────────────────────────────────────────────────────
  admin console write        customer created         subscription canceled
        │                          │                          │
        ▼                          ▼                          ▼
  config: bus.emit(            customers:              billing:
   'fonderie.config.changed')   bus.emit(...)           bus.emit(...)
        └──────────────┬───────────┴──────────────────────────┘
                       ▼
            @fonderie/events  (durable log, fonderie_events — unchanged)
                       │  consumer 'realtime'  (claimed ONCE, by one instance)
                       ▼
 ┌──────────────── @fonderie/realtime — the BROKER ─────────────────────────┐
 │ 1. catalog check  — topic declared streamable?  no → dropped (default deny)│
 │ 2. scope          — resolve { audience, workspaceId?, userId? }            │
 │ 3. project        — keep only the catalog's client-safe fields             │
 │ 4. broadcast      — pg_notify('fonderie_realtime', { id, topic, scope })   │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │  Postgres NOTIFY → every stream host
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
 STREAM HOSTS (long-running: container / VM, session-mode DB connection)
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ HUB: LISTEN fonderie_realtime → for each open connection on THIS host:   │
 │      topic ∈ connection.topics  AND  authorize(connection, scope)        │
 │      → write SSE frame                                                    │
 │ GET /realtime/stream?topics=…   requireAuth → withWorkspace → SSE         │
 └───────────────────────────────┬─────────────────────────────────────────┘
                                 │  text/event-stream (HTTPS)
                                 ▼
 CLIENT  @fonderie/client  client.realtime.subscribe(topics, onEvent)
         → client.config.watch(): on 'fonderie.config.changed' → config.load()
         → useRemoteConfig / useFlag re-render (no hook change, no spinners)
```

Why this shape:

- **The bus stays the source of truth** (durable, HMAC-signed, already wired in
  every brick). Realtime is one more consumer — exactly like webhooks — so a
  producer never knows streams exist and nothing new is emitted twice.
- **Exclusive claiming is used, not fought:** one instance processes each event
  once (catalog, scope, projection), then **broadcasts** to all hosts over
  `NOTIFY`. The bus does durability; the broker does fan-out.
- **NOTIFY carries a reference, not the data** (`{ id, topic, scope }`, far
  below Postgres' 8 KB payload limit). Hosts render frames from the projected
  payload stored with the event (see replay), never from raw bus payloads.

### 4.2 Topics, the catalog, and "all or individual"

A topic is an event type. A brick declares which of its events are streamable
through `describeEvents?()`, an optional module method in **core** (like
`describeAdmin`), so declaring adds no dependency and webhooks can read the
same list:

```ts
// e.g. in @fonderie/customers
describeEvents(): IEventCatalogEntry[] {
  return [{
    type: 'fonderie.customer.created',
    description: 'A customer was added to the workspace',
    audience: 'workspace',                    // who may receive it
    project: (p) => ({ customerId: p.customerId }),   // what the client gets
  }];
}
// in @fonderie/config — sourced from its existing NOTIFY, no bus needed
{ type: 'fonderie.config.changed', audience: 'public',
  source: { notify: 'fonderie_config_changed' },       // payload = environment
  project: (environment) => ({ environment }) }        // no keys, no values
```

| `audience` | Delivered to | Scope it needs |
|---|---|---|
| `public` | every connection, signed in or not | none (app-wide, e.g. config changed) |
| `workspace` | active members of `workspaceId` | `workspaceId` |
| `user` | that user's own connections | `userId` |
| `(ctx, scope) => boolean` | whatever the app decides (roles, `can()`) | app-defined — how `manager` is expressed without importing permissions |

**Default deny:** an event without a catalog entry is never streamed.
`fonderie.notification.send` (PINs, OTPs, reset tokens) simply has no entry.

Subscribing:

```
GET /realtime/stream                               → all topics I may receive
GET /realtime/stream?topics=fonderie.config.changed
GET /realtime/stream?topics=fonderie.customer.*,fonderie.billing.subscription.*
```

- Omitted or `*` = all catalog topics the connection is entitled to.
- Exact names or a trailing `.*` prefix. Matched with **escaped** input and
  segment semantics; unknown topics → `400` with the list of valid ones
  (`GET /realtime/topics` returns the catalog the caller may subscribe to).
- A subscription is per connection (no stored state); change it by
  reconnecting. Limits: max topics per connection, max connections per user.

### 4.3 Wire protocol

```
retry: 3000

id: 01J9…                        ← event id (monotonic enough to resume)
event: fonderie.config.changed
data: {"type":"fonderie.config.changed","data":{"environment":"production"},"at":"2026-09-29T10:00:00Z"}

: ping                            ← comment heartbeat every 25 s (keeps proxies open)

event: fonderie.stream.expiring   ← sent before the server closes for re-auth
data: {"reason":"TOKEN_EXPIRING"}
```

- Payloads are **invalidations first**: they say what changed; the client
  re-reads through its normal API (config → `GET /config/public`). No domain
  data is duplicated on the stream, and authorization of the data itself stays
  where it already is.
- **Resume (v1):** every (re)connect starts with `event: fonderie.stream.reset`
  and the client refetches what it shows (config → `load()`). Replay by
  `Last-Event-ID` is deferred: it would couple realtime to the events table,
  and with invalidation payloads a refetch gives the same result.

### 4.4 Authorization on a long-lived connection

- Connect: `requireAuth → withWorkspace` (so `ctx.user` + `ctx.workspace` are
  resolved and membership verified); `public`-only streams may connect
  anonymously.
- **Bounded lifetime instead of re-validation:** a connection closes after
  `maxLifetime` (default 15 min) or at the access token's `exp`, whichever is
  first, after sending `fonderie.stream.expiring`. The reconnect re-runs the
  app's own chain (session, suspension, membership), so realtime needs no auth
  or workspaces import. Revocation therefore takes effect within 15 min.
- If the app passes a bus, `fonderie.user.deleted` closes that user's
  connections at once (matched by event name, no import).
- Browsers: `EventSource` cannot set `Authorization`; the `access_token`
  cookie works same-origin. A short-lived stream ticket is out of scope for v1.

### 4.5 Hosting

- **Producers** can stay on serverless — they only emit to the bus, as today.
- **Stream hosts** must be long-running: one small always-on container is
  enough to start (it holds connections in memory and one LISTEN on a
  **session-mode** connection). Several hosts scale horizontally because
  fan-out is by NOTIFY, not by in-memory sharing.
- The broker (the `realtime` bus consumer) runs where the bus is drained — on
  the stream host is simplest, which also gives sub-second pickup (LISTEN on
  `fonderie_events`, not the 1 s poll).
- Deployment is the same app on a long-running host with only `/realtime/*`
  routed there, or `runRealtime({ bus, store, … })` as a standalone process
  (like `runWorker`). Documented in `examples/DEPLOYMENT.md`.

### 4.6 Client

```ts
const stop = client.realtime.subscribe(['fonderie.customer.*'], (e) => refetchCustomers());
client.config.watch();   // subscribes to fonderie.config.changed → load()
```

- Transport is pluggable: `fetch` with a streaming body (Expo `expo/fetch`,
  browsers) by default; injectable for other runtimes.
- Reconnect with backoff. `pause()` / `resume()` are called by the app from
  React Native's `AppState` (the SDK does not import react-native).
- **Degrades to polling** when the stream is unavailable (404, host down,
  older server) — today's behaviour, so nothing breaks.
- React: `useRealtime(topics, handler)`; `useRemoteConfig` calls `watch()`
  when the server advertises the stream.

---

## 5. Open questions (for the reviewer)

1. **Audience set** — are `public / workspace / user / manager` enough, or do
   we need permission-key audiences (`can('read', 'invoices')`) in v1?
2. **Payload policy** — invalidation-only (proposed), or allow the catalog to
   project small data (e.g. a job's new status) to save a round trip?
3. **Lifetime bound** — 15 min between re-authorizations acceptable, or
   tighter (5 min) at the cost of more reconnects?
4. **Standalone process vs same app** — ship `runRealtime()` in v1 or only
   "deploy the app on a long-running host"?
5. **Scope in meta** — lift `{ workspaceId, userId }` into `IEventMeta` at emit
   time (cleaner, touches every brick) or keep resolving from payload via the
   catalog (no brick changes)? The dependency budget favours the catalog.

## 6. Build order

1. **Transport:** `sseResponse()` in core; streaming + abort in `listen()`,
   Express, Koa; signal survives the body parser. Tests: a stream sends bytes
   before it ends, and a client disconnect runs cleanup — on all four.
2. **Catalog:** `IEventCatalogEntry` + optional `describeEvents?()` in core;
   escaped topic matcher in events (fixes R4); first entries: config, customers.
3. **Config:** declare `fonderie.config.changed` from its NOTIFY channel; NOTIFY
   on delete (fixes R3). No events dependency.
4. **`@fonderie/realtime`** (peer: core; optional peer: pg at `/pg` — a CI check
   fails on any other `@fonderie/*` import): broker, hub, `/realtime/stream`, `/realtime/topics`,
   lifetime bound. Negative tests: an uncatalogued event never reaches a
   stream; a workspace event never reaches a non-member; a connection closes
   at its lifetime.
5. **Client + hooks:** `client.realtime`, `config.watch()`, `useRealtime`, RN
   foreground handling, polling fallback.
6. **Consumer app:** drop `LIVE_SCREENS` and check-before-render; deploy one
   stream host.
7. **Later:** webhooks' event picker from the catalog; APNs/FCM wake-ups for
   backgrounded apps.
