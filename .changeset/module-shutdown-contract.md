---
'@fonderie/core': minor
'@fonderie/config': minor
'@fonderie/events': minor
---

One shutdown convention: `IFonderieModule.stop?()` and `FonderieApp.shutdown()`.

A module could acquire an interval, a pool, a LISTEN client or a listening
socket, and the framework offered no way to release any of it. Each brick that
cared invented its own name — `@fonderie/webhooks` had already grown a private
`stop()` with the comment *"without this the interval keeps the process alive
after shutdown"*, and nothing called it. `@fonderie/config` hid its cleanup
behind `.manager.stop()`, which an app had to know to reach inside for.

The cost is not theoretical: a process held open by a resource nobody released
exits never, with no error and no output. That is what hung this repo's CI for
six release cycles.

- `IFonderieModule.stop?(): void | Promise<void>` — optional, so no existing
  module changes. Must be idempotent.
- `FonderieApp.shutdown()` — calls them in **reverse install order**, so a
  module's dependencies are still alive while it shuts down. Every module is
  attempted even if one throws; failures are collected and thrown together, so
  one brick failing cannot strand the rest holding sockets, and a partial
  shutdown is still reported rather than swallowed.
- `ConfigModule.stop()` clears the TTL refresh interval and the LISTEN client.
- `EventsModule.stop()` releases the transport's pool, LISTEN client and poll
  loop.

Existing apps are unaffected until they call `shutdown()`. Serverless hosts
that never shut down cleanly lose nothing; anything with a SIGTERM path gains a
single call that releases everything.
