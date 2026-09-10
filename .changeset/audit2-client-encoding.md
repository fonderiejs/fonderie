---
"@fonderie/client": patch
---

URL-encode every path parameter uniformly. Path segments were interpolated raw in most modules (only a few call sites encoded), so an id containing `/`, `?`, or `#` — e.g. user-influenced input an app forwards as an id — could rewrite the request target. All path-segment interpolations now go through `encodeURIComponent`; query-string fragments are unchanged.
