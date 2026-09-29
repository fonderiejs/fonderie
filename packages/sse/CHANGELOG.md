# @fonderie/sse

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
