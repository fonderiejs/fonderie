---
'@fonderie/client': minor
---

`AuthAdminClient` — `@fonderie/auth`'s operator routes, typed

`findUser(email)`, `getUser(id)`, `listUserSessions(id)`,
`revokeUserSessions(id)`, `userLoginHistory(id, { limit, cursor })`,
`suspendUser(id)`, `unsuspendUser(id)`, with `IAdminUserDTO` (the app's
user DTO plus `deletedAt`). Same constructor as `AdminClient`, including
`prefix`. Not on `FonderieClient`: no user session reaches these.
