---
'@fonderie/react-admin': minor
---

New package: React hooks over `@fonderie/admin`

One per page — `useAttention`, `useManifest`, `useDoctor`,
`useAdminConfig`, `useAdminRoutes`, `useAdminTokens`, `useAdminLog`
(keyset-paged, `loadMore`). Each takes the `AdminClient`; nothing stores
the token. The shell that composes these with the existing config and courier
admin screens is the next phase (`docs/ADMIN-BRICK-DESIGN.md` §9, phase 7).
