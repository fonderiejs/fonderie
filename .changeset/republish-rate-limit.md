---
"@fonderie/rate-limit": patch
---

Republish `@fonderie/rate-limit` (1.0.1) to fix the broken `1.0.0` tarball — the third package from the earlier partial release with wrong peer ranges (`@fonderie/core@^1.0.0` / `store@^1.0.0` vs actual `0.2.0` / `0.1.2`), which makes a clean `npm install` of the SDK fail with `ERESOLVE`. Current source is correct (`core@^0.2.0`, `store@^0.1.1`); this `1.0.1` carries the corrected metadata. No code change. (Completes the events/customers `2.0.1` republish — those three were the packages whose `latest` tag had been stale.)
