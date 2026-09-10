---
"@fonderie/customers": patch
---

Label deletion can no longer destroy other tenants' data. `fonderie_customer_labels` is a shared vocabulary table (no workspace column), and `DELETE /customers/labels/:labelId` deleted unconditionally by id — one tenant could remove a label other tenants' emails/phones/addresses point at. Deletion now only succeeds for an **unreferenced** label; an in-use label returns `409 LABEL_IN_USE`. (Workspace-scoping the labels table itself is tracked as a follow-up schema change.)
