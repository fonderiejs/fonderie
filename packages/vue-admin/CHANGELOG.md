# @fonderie/vue-admin

## 0.2.0

### Minor Changes

- 201f6af: Users: hooks and the People page
  
  `useAdminUser` (lookup by email or id; `suspend`, `unsuspend`,
  `revokeSessions`), `useAdminUserSessions`, `useAdminLoginHistory`
  (paged) over `AuthAdminClient`. `UsersScreen` in the shell under a People
  group, shown when `authClient` is given: the account, its live sessions and
  recent sign-ins, with suspend / unsuspend / sign out everywhere. Phase 8b of
  `docs/ADMIN-BRICK-DESIGN.md`.

### Patch Changes

- Updated dependencies [201f6af]
  - @fonderie/client@0.26.0

## 0.1.0

### Minor Changes

- e8eb04c: New package: Vue composables over `@fonderie/admin`
  
  One per page — `useAttention`, `useManifest`, `useDoctor`,
  `useAdminConfig`, `useAdminRoutes`, `useAdminTokens`, `useAdminLog`
  (keyset-paged, `loadMore`). Each takes the `AdminClient`; nothing stores
  the token. The shell that composes these with the existing config and courier
  admin screens is the next phase (`docs/ADMIN-BRICK-DESIGN.md` §9, phase 7).

### Patch Changes

- Updated dependencies [e8eb04c]
  - @fonderie/client@0.24.0
