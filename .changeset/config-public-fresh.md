---
'@fonderie/config': patch
---

`GET /config/public` now reads fresh on every request, so a client that re-reads because it was told config changed gets the new value.

**The bug:** the route served each instance's in-memory snapshot, which is refreshed by a TTL timer (30s default) and by LISTEN. On serverless, neither is reliable: instances are frozen between requests, and a transaction pooler accepts LISTEN but never delivers the notifications. So an operator switched a screen off, the app was told at once and re-read, and an instance served the old value. No further event came, so the app kept showing the old value until its next reconnect.

**The fix:** the route awaits the new `RemoteConfigManager.reload()` before answering. That's one small query, and concurrent requests share it. A failed read keeps the previous snapshot. Server-side `getConfig(ctx, …)` still reads the snapshot and is unchanged.
