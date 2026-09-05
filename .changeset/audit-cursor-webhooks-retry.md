---
'@fonderie/audit': patch
'@fonderie/webhooks': patch
---

Audit pagination reaches past the max page, and webhook retries actually retry

Two silent runtime failures. In @fonderie/audit, the route over-fetched
`limit + 1` rows to detect a next page while the model re-clamped to
MAX_LIMIT — at the maximum page size the two caps cancelled, `nextCursor`
could never be set, and pagination silently ended at the boundary. The +1
over-fetch now lives inside the model (which returns `{ events, hasMore }`),
so no outer clamp can shave it off. The keyset cursor also now carries
`created_at::text` at full microsecond precision instead of a
millisecond-truncated JS Date — events created in the same millisecond
(e.g. within one transaction) are no longer skipped between pages — and
cursor halves are validated (timestamp shape, UUID) so a crafted cursor
yields an empty clause instead of a Postgres cast error. The route's limit
parse is NaN-safe.

In @fonderie/webhooks, `IPendingRetry` declared a nested
`{ delivery, url, secret }` shape that the flat claim-query row never
produced — `retry()` destructured `delivery` as undefined and threw on
every claimed row, swallowed by `Promise.allSettled`. Net effect: failed
deliveries were re-claimed every interval and never actually retried, with
nothing logged. The type is now the flat row it always was, `retry()`
destructures accordingly, and a new test pins the full path: claim →
re-attempt with correct URL/signature → marked delivered.
