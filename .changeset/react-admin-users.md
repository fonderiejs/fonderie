---
'@fonderie/react-admin': minor
'@fonderie/react-admin-screens': minor
---

Users: hooks and the People page

`useAdminUser` (lookup by email or id; `suspend`, `unsuspend`,
`revokeSessions`), `useAdminUserSessions`, `useAdminLoginHistory`
(paged) over `AuthAdminClient`. `UsersScreen` in the shell under a People
group, shown when `authClient` is given: the account, its live sessions and
recent sign-ins, with suspend / unsuspend / sign out everywhere. Phase 8b of
`docs/ADMIN-BRICK-DESIGN.md`.
