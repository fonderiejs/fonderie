---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/admin': minor
---

The operator's side of account deletion (docs/ACCOUNT-DELETION-DESIGN.md, Phase 5).

An operator could see that an account was deleted, but not when it would be erased, and could do nothing about it: not keep it for a person who asked support, not stop the erasure of an account under dispute, not erase one at once for an urgent verified request, and not show an auditor that an erasure happened.

- **Pending deletions.** Each archived account in the console shows when deletion was requested, when it will be erased, the channel it was confirmed by and whether the reminder went out (`IAdminUserDTO.deletion`).
- **Cancel on request** (`POST /_admin/users/:id/deletion/cancel`): the account is active again, `fonderie.user.restored` resumes billing, and the person is told on the channel they deleted with.
- **Legal hold** (`POST|DELETE /_admin/users/:id/deletion/hold`): the schedule neither reminds nor erases a held account until the hold is lifted; a hold must say why. Lifting it is a DELETE, so the console asks for a fresh authenticator code.
- **Erase now** (`DELETE /_admin/users/:id/deletion`, `eraseAccountNow`): only an account the person already asked to delete and that is not held; every eraser runs as on the schedule, and the receipt records `initiated_by: 'operator'`. Refused when the app gave no erasers, which would leave every other brick's data behind.
- **Receipts** (`GET /_admin/erasures`, `/_admin/erasures/export`): newest first, found by the address the person used (hashed with the same key, so `+tag` and case variants match), exported as CSV or JSON. They name no one.

Apply auth migration `024_deletion_hold` before deploying. For "erase now" to work, pass your erasers to `AuthModule` in `accountDeletion.erasers`, the same list the schedule runs.
