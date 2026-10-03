---
'@fonderie/billing': minor
'@fonderie/client': minor
'@fonderie/react-billing-screens': patch
'@fonderie/vue-billing-screens': patch
---

**A customer who paid with Stripe Link has a payment method on file.** `GET /billing/payment-method` reported cards only, so a customer whose saved method is Link (`type: 'link'`, no card details) saw "No card on file" right after paying, even though Link is what their subscription is charged with. The payment method is now reported for what it is:

- `IPaymentMethodDTO` gains `type` (`'card'` | `'link'`) and `email` (the Link account's, for `'link'`; null for a card). A Link method has `brand: 'link'`, an empty `last4` and a 0 expiry. Show it as "Link · ana@acme.example". In `@fonderie/client` both fields are optional, because servers that predate them do not send them: treat an absent `type` as `'card'`.
- Which method is shown: the consented id, then the customer's default (card or Link), then the newest card, then a saved Link method. A card is still preferred when there is no default.
- A Link method carries no card fingerprint: for fraud composition it is a missing signal, never a clean one.
- The prebuilt subscription screens (React and Vue) show "Link · email".
