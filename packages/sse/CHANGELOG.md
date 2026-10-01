# @fonderie/sse

## 0.2.5

### Patch Changes

- 54d2ec2: **`fonderie.*` event types are reserved for the bricks, and the event catalog is validated when every app boots.**
  
  - **Reserved prefix:** a module not named `@fonderie/*` that declares a `fonderie.*` type in `describeEvents()` is refused. The message suggests the app's own prefix (`app.job.assigned`).
    - Without this, an app event under the bricks' prefix collided the day a brick shipped the same name, and the app stopped booting after an upgrade.
    - The prefix is exported as `RESERVED_EVENT_PREFIX`.
  - **Validated at every boot:** `boot()` now validates the merged event catalog before any module installs. Before, only realtime delivery read it, so a duplicate type or an invalid entry went unnoticed in apps without `@fonderie/sse`.
  
  **`@fonderie/sse`:** an anonymous caller now gets the same `401` for a private topic and a nonexistent one. Before, a private topic answered `401` and an unknown one `400`, so anyone could list a deployment's private event names by probing. Signed-in callers still get `400` with the list of valid topics.
- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 0.2.4

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 0.2.3

### Patch Changes

- 2b14fef: Bus events are now published **before** the bus handler settles, so a serverless producer no longer loses them.
  
  **The bug:** found in production. The bus handler started the broadcaster's NOTIFY and returned at once. On Vercel the function is frozen as soon as its after-response work settles, so the NOTIFY often never left, while the bus had already marked the delivery processed. The event was lost with no error anywhere. Live config was unaffected, because it uses config's own NOTIFY channel; every *bus* event from a serverless producer was at risk (the first one seen was `fonderie.session.revoked`).
  
  **The fix:** the handler awaits the publish. A failure now throws, so the bus retries instead of recording a delivery that didn't happen.

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
