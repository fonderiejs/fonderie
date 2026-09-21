# @fonderie/vue-admin

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
