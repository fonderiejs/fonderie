---
'@fonderie/core': minor
'@fonderie/adapter-express': minor
'@fonderie/adapter-koa': minor
---

Server-Sent Events work end to end, the transport for realtime delivery to frontends (`docs/REALTIME-DESIGN.md`).

**New in `@fonderie/core`:**
- `sseResponse(signal, onOpen, options)` returns a `text/event-stream` Web Response. It sends heartbeat comments (every 25 s by default) and a `retry:` hint, and formats frames, including multi-line data. It cleans up exactly once when the client disconnects, the handler closes the stream, or `maxLifetimeMs` elapses. A handler error becomes an error frame.
- Node helpers `writeWebResponse`, `pipeWebBody`, `writeWebHead` and `abortOnDisconnect`, plus `isEventStream` and `formatSseEvent`.

**Transports:** core `listen()`, Express and Koa used to await `arrayBuffer()` on every response, so an endless stream never sent a byte. They also built the Web `Request` without a signal, so a handler never learned the client had left. They now stream `text/event-stream` bodies (with backpressure) and abort `ctx.request.signal` on disconnect. The body parser keeps that signal when it rebuilds the request. Every other response keeps the buffered path, unchanged, `Content-Length` included. Hono already streamed and is now covered by tests.

**New optional parameters:** `expressRequestToWeb(req, maxBytes, signal?)` and `koaContextToWeb(ctx, maxBytes, signal?)`.
