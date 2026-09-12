---
'@fonderie/core': minor
---

A trailing slash in a configured CORS origin no longer takes the whole API offline, and `origin` now accepts a list.

An `Origin` header is `scheme://host[:port]` — RFC 6454 gives it no path and no trailing slash — so a configured origin carrying one could never match any request. It was nonetheless the easiest mistake to make, since every address bar and dashboard "copy URL" includes the slash, and the punishment was disproportionate: the browser blocks every request, and the app surfaces it as "can't reach the server" rather than anything pointing at CORS. String origins are now normalized (trailing slashes stripped, whitespace trimmed, scheme/host lowercased — all case-insensitive per spec). A path in an origin is a different mistake that normalizing cannot repair, so it warns at boot instead.

`origin` also accepts `string[]`, because an apex domain and its `www` are two distinct origins that a single string cannot express — previously that forced every app to hand-roll a predicate.

Two details that matter: the header echoes the **request's** origin on a match, never the normalized spelling, since the browser compares byte-for-byte against what it sent. And `Vary: Origin` is now emitted for single and list origins too, not only predicates — the response genuinely does vary by origin, so without it a shared cache could serve one origin's `Access-Control-Allow-Origin` to another.
