---
'@fonderie/billing': patch
---

Fix: `GET /billing/invoices` now unions invoices across all of a subscriber's provider customers, not just one. A pay-as-you-go buyer gets a wallet customer from their first credit-pack purchase, and a later subscription checkout can resolve/create its own customer — splitting invoices across two Stripe customers. `listInvoices` previously queried only the wallet customer (via `resolveCustomer`), so subscription invoices were invisible. It now gathers the wallet customer and the subscription customer, queries each, and merges (deduped by id, newest first) so pack and subscription invoices appear together.
