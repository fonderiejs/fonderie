---
'@fonderie/billing': minor
---

**The `'db'` rate-limit backend is fit for per-request counters.** It used to insert one `fonderie_usage_records` row per request and sum the whole window on every request, with nothing ever deleting a row — a 100k/day limit meant summing up to 100k rows per request, forever growing. `'memory'` is no alternative on serverless, where each instance counts alone and resets on every cold start.

Windowed counters now live in a new table, `fonderie_usage_counters` (migration `015_usage_counters.sql` — run your migrations): one row per subscriber, metric and window, updated by a single atomic upsert that returns the new total, so concurrent requests never lose a count. Windows are the fixed, epoch-aligned periods `resetsAt` already advertised (a `'1d'` limit resets at 00:00 UTC). Ended windows are dead weight: call the new `purgeUsageCounters(store)` from a cron (the backend also purges opportunistically, at most every 10 minutes per process). `counterWindow(windowMs)` is exported for tests and tooling.

Counts held under the old scheme are not carried over — each counter starts at zero in the current window after the upgrade. `recordUsage` / `getUsage` (`POST`/`GET /billing/usage`) are unchanged and still use `fonderie_usage_records`.
