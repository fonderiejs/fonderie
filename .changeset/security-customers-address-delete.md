---
"@fonderie/customers": patch
---

Scope address deletion to the owning customer. `DELETE /customers/:customerId/addresses/:addrId` deleted the underlying shared `fonderie_addresses` row unconditionally by id — even when the customer-scoped link delete matched nothing — so any authenticated caller could destroy another customer's (or another tenant's) address with a guessed id. The base-row delete now only runs when the scoped link delete actually matched, and a foreign/unknown `addrId` returns `404 NOT_FOUND` instead of a false `200`.
