---
"@fonderie/customers": minor
"@fonderie/client": minor
"@fonderie/react-customers": minor
"@fonderie/vue-customers": minor
"@fonderie/react-auth": patch
"@fonderie/react-native-auth": patch
"@fonderie/vue-auth": patch
---

Customers pagination, and an MFA setup type correction.

**Pagination (A-104):** `GET /customers` now returns `total` (matching rows regardless of limit/offset) alongside the page. `useCustomers` gains `total`, `hasMore`, and `loadMore()` — an append-fetch of the next page over the same params, mirroring `useAuditEvents`' pagination ergonomics.

**Type correction:** `IMfaSetupResult` now matches what `@fonderie/auth`'s `/auth/mfa/setup` actually returns — `{ qr, backupCodes }` (a data-URI QR code and the one-time backup codes) — instead of the fictional `{ secret, uri }` that never existed at runtime. `useMfaSetup`'s `setupData` is now correctly typed for display.
