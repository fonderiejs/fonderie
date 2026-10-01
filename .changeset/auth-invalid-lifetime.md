---
'@fonderie/auth': patch
---

An unreadable session or access-token lifetime now falls back to the default (with one warning) instead of throwing.

**Found in production:** an app's runtime resolver returned `String(undefined)`, the **text** `"undefined"`, as `sessionDuration`. Once refresh used the resolved config (7.17.0), `jsonwebtoken` threw and **every refresh answered 500**. Auth no longer trusts a resolver's lifetime blindly: a value that isn't a duration (`'90d'`, `'1h'`, …) falls back to the default, and an unreadable `sessionMaxAge` is ignored.
