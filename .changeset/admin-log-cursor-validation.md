---
"@fonderie/admin": patch
---

Validate the admin-log pagination cursor before it reaches the query. `GET /_admin/activity/admin-log?before=…` previously decoded the cursor with a lax local helper and passed its fields straight into `::timestamptz` / `::uuid` casts, so a crafted cursor surfaced as a 500. The route now decodes with core's range-checked `decodeKeysetCursor` and answers `422 INVALID_PARAMETER` on anything malformed, out-of-range, or in the old pipe format — previously issued admin cursors are rejected after upgrade (re-request the first page).
