---
'@fonderie/core': minor
---

Export `normalizeRequestPath` and `normalizeMountPath` — one definition each

Path normalization had drifted into fifteen copies across the monorepo with
**two different rules** wearing the same look. The router stripped one
trailing slash from a request path; `reserve()` stripped many from a prefix;
`basePath` stripped one — so a `basePath` typed `/v1//` left every route with
a double slash. Six admin clients each carried their own copy.

Two exported functions, because they are genuinely two jobs:

- `normalizeRequestPath(p)` — what a client asked for: drop the query string
  and a trailing slash, `/` stays `/`. This is what the router matches on, so
  a handler reasoning about its own path now agrees with routing by
  construction. Used by `matchPath`, `@fonderie/admin` (its served page and
  its log), `@fonderie/media` (recovering `basePath`, which a trailing slash
  used to defeat) and `@fonderie/logger`.
- `normalizeMountPath(p)` — where something is mounted, from config: every
  trailing slash goes, and `''` stays `''`. Used by `basePath` (the fix
  above), `reserve()` and `AdminModule`'s `path`.

Merging them would be the bug: `normalizeRequestPath('')` is `'/'`, which as
a `basePath` would prefix every route with a slash.

Deliberately left alone: `normalizeOrigin` (an origin is `scheme://host:port`
and must not carry a path at all), `@fonderie/billing`'s webhook-URL
comparison (full URLs, not router paths), and `@fonderie/client`'s copy — it
ships with zero runtime dependencies on purpose, so it keeps one local copy
shared by its six admin clients instead of importing a server package.
