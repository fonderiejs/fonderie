---
'@fonderie/billing': minor
'@fonderie/client': minor
'@fonderie/react-billing': minor
'@fonderie/vue-billing': minor
---

**The invoice list no longer stops at 20.** `GET /billing/invoices` returned the newest 20 invoices and silently dropped everything older. It now pages newest first by keyset (`?limit=` 1–100, default 20; `?cursor=`) and answers `nextCursor`. `client.billing.listInvoices({ cursor, limit })`; `useInvoices()` gains `nextCursor`, `hasMore` and `loadMore()` (React and Vue), like `useWalletTransactions`. Providers receive an optional `createdLte` bound; one that ignores it still never repeats a row.

**A usage screen can show the rate limit.** `GET /billing/usage/:metric` only summed usage records, so a windowed plan limit such as `'api-calls': { limit, window: '1d' }` — a counter, not records — always read 0. For such a metric it now answers from the live counter: `kind: 'counter'`, `total` used in the current window, `limit`, `status` (`ok` | `warning` | `over_limit` | `blocked`), `window`, `since` and `resetsAt`. Other metrics keep the records sum (`kind: 'records'`) and also report the plan's `limit`. `useUsage()` returns the whole reading as `usage` alongside `total` (React and Vue); `IUsageResult` is re-exported by the hook packages.
