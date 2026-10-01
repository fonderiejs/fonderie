---
'@fonderie/core': minor
'@fonderie/adapter-hono': patch
'@fonderie/adapter-express': patch
'@fonderie/adapter-koa': patch
---

`drainQueue` now drains **after** the request's own background work, so an event a serverless request emits is delivered by that request, not by some later one.

**The bug:** found in production while testing live sign-out. With a platform runner (Vercel's `waitUntil`, via `installPlatformBackgroundRunner`), `background(bus.emit(...))` returns at once, so the event is written a moment **after** the response. The after-response drain started immediately, found nothing, and the instance froze. The event stayed `pending` until another request happened to drain it, seconds or minutes later, and every event-driven feature was delayed by that much.

**The fix:**
- `background()` tracks work in flight.
- New `backgroundSettled(timeoutMs?)` resolves once the work handed off so far has settled. It's bounded, and it never waits on work handed off afterwards.
- The Hono, Express and Koa `drainQueue` middlewares wait for it before draining.
- A drain hands itself off with `background(work, { settles: false })`, so it is never counted. If it were, each response's drain would wait for the previous drain, and N responses would run N drains in a row instead of joining one. This was caught on CI before release.
- Tracked work that never settles is forgotten after `FONDERIE_BACKGROUND_TIMEOUT_MS`, so one hung task can't delay every later drain.

A test reproduces the race and fails with the old drain.
