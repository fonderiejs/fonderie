---
'@fonderie/billing': patch
---

Fix blank purchase receipts from the checkout and auto-recharge paths

Three call sites emit `billing.payment-receipt` — the in-app saved-card purchase,
the hosted-checkout webhook, and auto-recharge — and each assembled its own
payload. When the receipt gained an amount, a line item and an invoice reference,
only the first was updated. Receipts from the other two arrived with the numbers
rubbed out: a "Total paid" label with nothing beside it.

Nothing failed, which is why it shipped. A missing variable interpolates to
empty, and the template-coverage test validates the template against
SAMPLE_PAYLOADS — one idealised payload — not against what the emitters send.

The payload is now built once by `buildReceiptData`, and all three call sites use
it. A caller may supply less (auto-recharge knows no invoice; hosted checkout has
no invoice number) but cannot supply a different shape, and adding a template
field means adding it in one place rather than remembering three. A test asserts
the builder covers every variable the template uses.
