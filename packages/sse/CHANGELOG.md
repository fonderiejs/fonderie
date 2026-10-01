# @fonderie/sse

## 0.2.2

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 0.2.1

### Patch Changes

- cc963a4: A stream request that carries credentials the app's auth chain can't verify now gets a **401**, not a silent anonymous stream.
  
  **The bug:** found in production. A phone's saved token had been signed with a since-rotated secret. The auth chain couldn't verify it, so `ctx.user` stayed empty, and `GET /sse/stream` answered **200 as an anonymous stream**. The stream got only public events, and the client had no signal to refresh. An access token expiring between the stream's lifetime reconnects would end up the same way.
  
  **The fix:** a `Bearer` credential with no resolved user is refused with `401 UNAUTHORIZED`. The client already refreshes once on a 401 and reconnects as the user, or the app signs out. A request with no credentials at all is still a legitimate anonymous stream.

## 0.2.0

### Minor Changes

- e6f2c81: Support for a serverless API paired with a long-running stream host.
  
  **The gap:** the event bus creates delivery rows only for subscriptions registered in the process that *publishes* an event. A stream host that alone registers SSE therefore never received events published by a serverless API. Config changes were unaffected, since they arrive through Postgres NOTIFY.
  
  **New options:**
  - `SseModule({ streams: false })` makes an instance a producer only. It subscribes to the bus and publishes to the broadcaster, but serves no streams and registers no routes. Register it on the serverless API.
  - `PgBroadcaster({ listen: false })` publishes only, through a small pool. NOTIFY is an ordinary statement, so a transaction-mode pooler (the API's usual `DATABASE_URL`) works.
  
  The stream host keeps the default `streams: true` with a listening broadcaster on a session-mode connection.

## 0.1.0

### Minor Changes

- 61d8b22: New package: Server-Sent Events delivery to frontends. It is step 4 of `docs/REALTIME-DESIGN.md`, and the client-side sibling of `@fonderie/webhooks`.
  
  **Endpoints:**
  - `GET /sse/stream?topics=…` subscribes to everything the caller may receive (`*`, the default), to exact event types, or to `prefix.*` families.
  - `GET /sse/topics` lists what the caller may subscribe to.
  
  **Who receives what:**
  - Each brick's `describeEvents()` catalog decides, and the default is deny: an event with no entry never reaches a stream.
  - Audiences are public, workspace (the connection's `ctx.workspace`), user, or an app rule.
  - Payloads are the entry's projection: ids only.
  
  **Fan-out:** in-process by default. `PgBroadcaster` (`@fonderie/sse/pg`, with `pg` as an optional peer) fans out across instances over LISTEN/NOTIFY, and also hears a brick's own NOTIFY channels, which is how config changes arrive.
  
  **Connections:**
  - Each stream starts with `fonderie.stream.reset`, since v1 has no replay.
  - A stream closes after `maxLifetimeMs` (15 min) so that the reconnect re-runs the app's auth chain, and `fonderie.stream.expiring` arrives shortly before.
  - Limits apply per connection (topics) and per user (streams).
  
  **Dependency budget:** `@fonderie/core` is the only required peer. Auth, workspaces and permissions are never imported (`ctx.user` / `ctx.workspace` come from the app's own middleware), and the bus is accepted by shape.
