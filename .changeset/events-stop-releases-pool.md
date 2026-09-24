---
'@fonderie/events': minor
---

`PGTransport.stop()` now releases the connection pool it opened.

`start()` creates a pool; `stop()` closed the LISTEN client and returned,
leaving that pool open for the life of the process. Every process that stopped
a bus leaked it, and a process that did so during shutdown never exited.

That is what had been hanging CI. `npm test` finished, every suite printed
`fail 0`, and turbo then waited forever on an events test process whose pools
were still open. It cost six release cycles and survived two deliberate bisects
— 25 jobs, no reproduction — because whether the process eventually exits
depends on pg's idle timeout racing an in-flight poll query. It happened about
three times a day and never once on demand. A `ps` tree taken at the hang named
the process directly, which is what ended the hunt.

`stop()` now, in order: stops the loop, **waits** for it to finish (it was
fire-and-forget, so a poll query could still be in flight and ending the pool
underneath it races an active client), ends the LISTEN client, ends the pool,
and resets the transport to its pre-start state.

Two consequences worth knowing:

- Reads after `stop()` — `deadLetters()`, `pendingCount()`, `consumerBacklogs()`,
  `storeForIntegrity()` — now answer emptily rather than querying a live pool,
  matching how they already behaved before `start()`. A health route may keep
  calling them unconditionally.
- `publish()` without a started transport now throws a named error instead of a
  bare `Cannot read properties of undefined`. That applies before `start()` too,
  where it was always an opaque crash.
