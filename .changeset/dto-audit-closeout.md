---
'@fonderie/config': minor
'@fonderie/client': minor
'@fonderie/workspaces': minor
'@fonderie/webhooks': minor
'@fonderie/customers': patch
'@fonderie/auth': patch
---

DTO audit closeout: config value parity, actor attribution, and the last shape lies

Config admin responses now serve the PARSED value the runtime read path
serves — previously `setConfig(key, { value: { a: 1 } })` read back as the
string `'{"a":1}'` and the shipped editor re-stringified it into a
degradation loop on every save. Writes honor `active: false` instead of
silently forcing `true` (list reads filter on it), and both admin clients
accept an `actor` option sent as `X-Actor` on writes, so `updatedBy` and
revision history can attribute changes to a person instead of
'admin-token'. `HttpClient` gained per-request extra headers to carry it.

Workspaces: `updateWorkspaceSchema`'s address validated `region`/
`postalCode` — names nothing writes — while the real `state`/`zip` rode
through `.passthrough()` unvalidated; the schema now matches the persisted
shape and strips unknowns. `IWorkspaceDTO` exposes `archivedBy` (fetched by
every query, dropped by the mapper) beside `isArchived`/`archivedAt`.

Webhooks: `IWebhookDeliveryDTO` carries `payload`, `responseBody`, and
`nextAttemptAt` — all fetched, all previously discarded, all exactly what a
delivery-history UI needs to debug a failing endpoint.

Customers: the email/phone/address update schemas shrink to the one field
the controllers apply (`label`) — content changes are remove-and-re-add and
`setPrimary` has its own route, so the old wider schemas validated bodies
that were silently ignored.

Auth: `mfa_secret` no longer rides along on every user fetch — `USER_COLUMNS`
drops it and `mfa.disable` fetches on demand via `getMfaSecret` like
`mfa.verify` always did (removing an untyped cast). `IUpdateProfileInput`
models explicit-null clears like the workspaces input already did, and the
client documents that the server's phone-auth register/login variant is a
deliberate deferral to its own feature cycle.
