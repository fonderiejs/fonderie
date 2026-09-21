---
'@fonderie/auth': minor
---

Describe the operator's user routes for `@fonderie/admin`

`describeAdmin()` offers, under the admin prefix and behind its one token:
`GET /users?email=`, `GET /users/:id`, `GET` and `DELETE
/users/:id/sessions` (sign out everywhere), `GET /users/:id/login-history`
(paged like the user's own), and `POST /users/:id/suspend` /
`unsuspend`. The lock is `users.suspended`, which login, refresh and the
session middleware already enforce — it only lacked a switch.
`UserModel.setSuspended(id, suspended)` is that switch.

The admin view is the app's own user DTO plus `suspended`, `deletedAt`,
`createdAt`; never the password hash or an MFA secret. There is no
standalone surface: these routes exist only when `@fonderie/admin` is
installed, and every call lands in its admin log. Phase 8a of
`docs/ADMIN-BRICK-DESIGN.md`.
