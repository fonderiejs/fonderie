---
'@fonderie/client': patch
---

A config change event now invalidates the cached `/config/public` answer, so a pushed change is actually picked up. Apps keep their response cache.

**The bug:** found on a phone. The change event arrived and the client re-read `/config/public`, but an app that passes a response cache (`new FonderieClient({ cache: createMemoryCache() })`) got the **old** value back from the cache. The load time moved; the value never did. Every test ran without a cache.

**The fix:** `ConfigClient.load()` requests with `bust: true`. It skips any cached answer, fetches, and **stores the fresh one** in the cache. Readers never fetch: they read the client's snapshot. Upstream is asked only when an event says config changed, or when the stream reconnects.
