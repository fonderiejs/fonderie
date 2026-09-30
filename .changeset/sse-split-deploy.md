---
'@fonderie/sse': minor
---

Support for a serverless API paired with a long-running stream host.

**The gap:** the event bus creates delivery rows only for subscriptions registered in the process that *publishes* an event. A stream host that alone registers SSE therefore never received events published by a serverless API. Config changes were unaffected, since they arrive through Postgres NOTIFY.

**New options:**
- `SseModule({ streams: false })` makes an instance a producer only. It subscribes to the bus and publishes to the broadcaster, but serves no streams and registers no routes. Register it on the serverless API.
- `PgBroadcaster({ listen: false })` publishes only, through a small pool. NOTIFY is an ordinary statement, so a transaction-mode pooler (the API's usual `DATABASE_URL`) works.

The stream host keeps the default `streams: true` with a listening broadcaster on a session-mode connection.
