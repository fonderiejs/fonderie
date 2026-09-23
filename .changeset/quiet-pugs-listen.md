---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
---

The Users page lists on arrival instead of demanding an email first

`GET /_admin/users` required `?email=` and answered 422 without it, so the
operator screen opened as an empty box: you could only see an account you could
already name. Nobody can answer "who signed up this morning" that way, and it
is the opposite of what an operator surface is for.

Without `email` the route now returns a keyset-paginated page, newest first —
the same cursor contract as login history and the audit log, `{ users,
nextCursor }`. With `email` it is the exact lookup it always was, unchanged.
Not a new route, so the token scope stays `read`, derived as before.

Ships `AuthAdminClient.listUsers()`, `useAdminUsers` for React and Vue, and the
Users screen listing with Load more; clicking a row, or looking up an email,
opens the account detail as before.

Includes an index on `fonderie_users (created_at DESC, id DESC)` — **run the
auth migrations**. Keyset paging orders by that pair and the table had only an
email index, so every page would otherwise sort the whole table.

The list is the same allowlist DTO as the lookup: `passwordHash` and
`mfaSecret` cannot appear, and a test asserts it against the list response too.
