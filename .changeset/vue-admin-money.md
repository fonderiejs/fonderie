---
'@fonderie/vue-admin': minor
'@fonderie/vue-admin-screens': minor
---

Money: hooks and the Catalog and Subscriber pages

`useAdminCatalog` (configured vs stored; `createPlan`, `updatePlan`,
`deletePlan`) and `useAdminSubscriber` (subscription, wallet, paged ledger,
`grant`) over `BillingAdminClient`. `CatalogScreen` and `SubscriberScreen`
under a Money group in the shell, shown when `billingClient` is given. The
one write on the subscriber page is a manual grant, idempotency-keyed per
click. Phase 8c-ui of `docs/ADMIN-BRICK-DESIGN.md`.
