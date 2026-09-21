---
'@fonderie/client': minor
---

`prefix` on `ConfigAdminClient` and `CourierAdminClient` — reach the composed surface with the one token

`new ConfigAdminClient({ baseUrl, adminToken, prefix: '/_admin' })` sends
`/_admin/config…` instead of the brick's standalone `/admin/config…`, so the
config, secrets and template screens can sit inside the admin shell behind
`@fonderie/admin`'s token. Unset keeps today's paths. The path literals are
unchanged in source; the prefix replaces the leading `/admin` at request
time.
