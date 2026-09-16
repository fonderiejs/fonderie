---
'@fonderie/billing': minor
---

Make the purchase receipt an actual receipt

It said "credits were added to your balance" and nothing else — a balance
notification, not a receipt. It stated **no amount paid**, cited nothing the buyer
could reference, and pointed at no document. That is what an accountant bounces
back.

The data was already there. `applyPackCredit` receives `amountPaid` and
`paymentCurrency`, and `chargeViaInvoice` returns `invoiceNumber`,
`hostedInvoiceUrl` and `invoicePdf`. None of it reached the template.

The receipt now leads with the amount paid in real currency, itemises what was
bought by its display name, states the invoice number, and links the invoice PDF.
Balance-after stays, as the thing the buyer actually wanted.

The invoice reference is captured inside the charge branch where the return type
is known — the two charge methods are not discriminated, so narrowing the union
afterwards widens the property to `unknown`. A direct card charge produces no
invoice, so those lines simply do not render rather than showing blanks.
