---
'@fonderie/media': patch
'@fonderie/logger': patch
'@fonderie/client': patch
---

Use one definition of a request path

`@fonderie/media` recovered the app's `basePath` by stripping `/media` off
the request path, which a trailing slash defeated — `/v1/media/` yielded no
basePath and the served URL came out wrong. It now normalizes first.
`@fonderie/logger` logs the normalized path, so `/x` and `/x/` group as one
route. `@fonderie/client`'s six admin clients shared six copies of the same
prefix strip; now one, kept local because this package has zero runtime
dependencies by design.
