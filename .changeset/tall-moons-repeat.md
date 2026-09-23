---
'@fonderie/billing': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
---

The Subscriber page lists on arrival instead of asking for a type and an id

`GET /_admin/subscriptions` returns a keyset-paginated page of subscribers,
newest first — `{ subscriptions, nextCursor }`, the same cursor contract as the
wallet ledger. The existing `/subscriptions/:type/:id` lookup is unchanged.

The screen opened as an empty form asking for a subscriber type and id, which
is answerable only if you already knew both. Now it lists, and a row opens the
detail view — subscription, wallet, ledger and the manual grant — exactly as
before.

`limit` is clamped strictly (`NaN`, `<1` or `>100` ⇒ 422) and a malformed
cursor is 422, matching how the wallet ledger behaves in this package rather
than auth's and audit's silent clamp.

Includes an index on `fonderie_subscriptions (created_at DESC, id DESC)` —
**run the billing migrations**. The table carried no index at all: every read
so far was by subscriber, which a small mirror serves from a scan, but a keyset
page is a range scan and would otherwise sort the whole table each time.

Ships `BillingAdminClient.listSubscriptions()`, `useAdminSubscribers` for React
and Vue, and both Subscriber screens listing with Load more.
