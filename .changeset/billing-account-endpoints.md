---
'@fonderie/billing': minor
---

Add read-only billing-account endpoints for in-app billing pages: `GET /billing/payment-method` (the customer's card on file — brand/last4/expiry) and `GET /billing/invoices` (invoice history, each linking out to the provider-hosted invoice). Both resolve the provider customer from the wallet customer first (so pay-as-you-go users with no subscription still see their card) then the subscription.

Backed by two new optional `IBillingProvider` methods — `getPaymentMethod` and `listInvoices` — implemented by `StripeProvider`. They follow the existing optional-capability convention: when a provider implements neither, the routes answer `501`, so this is additive and non-breaking for existing providers. Adds `IPaymentMethodDTO`/`IInvoiceDTO` (+ `toPaymentMethodDTO`/`toInvoiceDTO`) and the `INormalizedCard`/`INormalizedInvoiceSummary` provider types.
