---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/react-customers': minor
'@fonderie/vue-customers': minor
'@fonderie/react-audit': minor
'@fonderie/vue-audit': minor
'@fonderie/react-webhooks': minor
'@fonderie/vue-webhooks': minor
---

**Customer, audit and webhook screens open on their data and follow a workspace switch.** `useCustomers` and the customer sub-resource hooks (emails, phones, addresses, notes, tags, relationships, labels), `useAuditEvents` and the webhook hooks loaded once per mount on a spinner. The selected-workspace reads among them never re-read after a switch. They now go through the client's shared store like the billing and workspaces hooks: data on the first frame when seen before, refreshes behind what is shown, no redraw when the answer is unchanged, a write under the same resource refreshes them everywhere, and a workspace switch reads the other workspace's entry without showing the previous one. Return shapes and `refresh({ force })` semantics are unchanged.

- `@fonderie/react` / `@fonderie/vue`: `usePagedQuery(source, path, readFirst, readMore, opts)` for cursor- or offset-paginated lists. The first page is the cached read, and pages appended by `loadMore` belong to the exact first page they extend: an unchanged refresh keeps them, a changed first page re-anchors the list. `rethrowLoadMore: false` reports a failed page on `error` only. `customers` and `audit` use it, because their `loadMore` never threw. Vue `useScopedQuery` gains `enabled`, as React's already had.
- `@fonderie/client`: `queryParams(params)`, a stable key fragment for a filter object (property order and undefined values do not change it).
- Lists filtered by params (customers, audit) are keyed by the filters' content, so the same filters on two screens share one entry.
