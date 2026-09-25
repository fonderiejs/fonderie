---
'@fonderie/events': patch
---

`runWorker(...).stop()` can no longer hang forever, and always releases the port.

`stop()` awaited the drain in flight unconditionally:

```ts
await inFlight?.catch(() => {});
if (server) await new Promise((r) => server.close(() => r()));
```

A drain that never settles — a query against a pooler that has gone away, a
handler waiting on a promise nobody resolves — froze `stop()` on the first line,
**before** the server was closed. The listening socket then kept the process
alive with no error and no output.

**This is the CI hang** that cost six release cycles: `npm test` finished, every
suite printed `fail 0`, and turbo waited forever. The handle dump from a hung
run named `worker.test.ts` holding `{"PipeWrap":2,"TCPServerWrap":1}`, and a
stalled drain reproduces that signature byte for byte.

Both waits are now bounded: the in-flight pass gets 10s, then the server closes
regardless; the close itself gets 5s after `closeIdleConnections()`, then
remaining sockets are severed. Abandoning a pass mid-drain was already the
normal case — a scale-to-zero platform SIGTERMs routinely, and the visibility
lease exists precisely so abandoned rows come back. Waiting for it is a
courtesy, not something worth never shutting down for.
