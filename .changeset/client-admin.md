---
'@fonderie/client': minor
---

`AdminClient` — the operator's surface, typed

`new AdminClient({ baseUrl, adminToken, prefix = '/_admin', actor? })` with
`attention()`, `manifest()`, `doctor()`, `config()`, `routes()`, `tokens()`
and `adminLog({ limit, before })`, plus the page types. Deliberately not on
`FonderieClient`: no user session can reach this surface. `prefix` follows
the app when it moved the surface.
