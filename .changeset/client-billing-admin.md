---
'@fonderie/client': minor
---

`BillingAdminClient` — `@fonderie/billing`'s operator routes, typed

`catalog()`, `createPlan()`, `updatePlan()`, `deletePlan()`,
`subscription(type, id)`, `wallet(type, id, currency?)`,
`walletLedger(type, id, { currency, limit, cursor })`, `grant(input)` —
with `IAdminCatalog`, `IAdminSubscriptionDTO`, `IAdminWalletDTO`,
`IAdminWalletLedgerPage`, `IAdminPlanInput`, `IAdminGrantInput`. Same
constructor as the other admin clients, `prefix` included.
