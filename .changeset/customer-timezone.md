---
"@fonderie/customers": minor
"@fonderie/client": minor
"@fonderie/core": minor
"@fonderie/workspaces": patch
---

A customer has a time zone. Quotes and invoices print times, and a customer already had a language but no zone, so an app could only print the business's zone, even for a customer three zones away.

- **customers:** `timezone` (IANA, e.g. `'America/Toronto'`) on `POST /customers` and `PUT /customers/:customerId`. It is optional, and `null` clears it. A name that is not a time zone answers `422 INVALID_PARAMETER` with `timezone: …` in the explanation. The customer DTO carries `timezone`, which is `null` when none is set; use the business's zone (workspace `settings.timezone`) then. Apply customers migration `017_customer_timezone`, which adds a nullable column.
- **client:** `ICustomerDTO.timezone`, plus `timezone` on `ICreateCustomerInput` and `IUpdateCustomerInput`.
- **core:** `isTimeZone(zone)`, the IANA check that workspaces used for `settings.timezone`, so customers and workspaces accept the same zones. Workspaces now imports it from core and behaves the same.
