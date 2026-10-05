---
'@fonderie/customers': minor
'@fonderie/billing': minor
---

Account erasure for customers and billing (account deletion design, Phase 4). Both ship an `accountEraser` for auth's `accountDeletion.erasers`, run in-process before the account row goes, so a failure keeps the account archived and the purge retries.

- **customers** — `accountEraser(store)` clears the person from the customers they created (`created_by`) and the notes they wrote (`author_id`), in one statement. The customer records and notes stay: they are the business's, not the person's.
- **billing** — `accountEraser(store, { provider })` deletes every payment-provider customer that carries the person's email and goes with them: their own customers, and the customers of workspaces they own with no one else in them. Before, only the customers of their own subscriptions were deleted, and only after the purge. A team that survives them keeps its customer, and their email on it is replaced with the workspace's business email, or removed if there is none (new optional provider method `replaceCustomerEmail`, implemented for Stripe). Subscriptions, the wallet ledger and invoices stay as financial records under an id that no longer resolves to a person. List billing's eraser before the workspaces eraser.
- **billing** — every customer created at the provider is now recorded when it is created, with the account whose email it carries (`fonderie_billing_customers`, migration 017). Before, a customer created for card setup with the wallet off, or for a checkout that was abandoned, was recorded nowhere. Erasure could not find it, and with the wallet off, saving the card failed with `422 NO_CUSTOMER`. Customers created before this release that no row points at cannot be found from the database.
