---
'@fonderie/client': patch
---

Remote config re-reads now bypass the client's response cache, so a pushed change is actually picked up.

**The bug:** found on a phone. The change event arrived and the client re-read `/config/public`, but an app that passes a response cache (`new FonderieClient({ cache: createMemoryCache() })`) got the **old** value back from the cache. The load time moved; the value never did. Every test ran without a cache.

**The fix:** `ConfigClient.load()` requests with `cache: false`. A load only happens because the server said config changed or the stream reconnected, so a cached answer is always the wrong one.
