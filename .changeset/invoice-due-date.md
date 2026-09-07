---
'@fonderie/billing': patch
'@fonderie/client': patch
---

`IInvoiceDTO` now carries `dueDate` (ISO-8601, or null). `GET /billing/invoices` surfaces each invoice's payment-terms due date from the provider (`StripeProvider` maps `invoice.due_date`); one-time charges are paid on capture and carry `null`. Lets a billing UI show a "Due" column alongside the payment date.
