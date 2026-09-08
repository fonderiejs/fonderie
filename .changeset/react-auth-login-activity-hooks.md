---
'@fonderie/react-auth': minor
---

Add `useLoginHistory` and `useSessions`. `useLoginHistory` paginates the caller's own login attempts (cursor + `loadMore`, filterable by outcome/date) with the same return shape as `react-audit`'s `useAuditEvents`, so a login-history table and an audit-log table build against an identical contract. `useSessions` lists the caller's live sessions (one flagged `current`) and exposes `terminate(id)` (optimistic removal, rolls back on failure) and `terminateOthers()` (refetches from the server rather than guessing which survived). Both re-export the `@fonderie/client` symbols they surface, keeping one import per package.
