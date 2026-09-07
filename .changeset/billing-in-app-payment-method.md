---
'@fonderie/billing': minor
---

Add in-app payment-method management so a card can be added, replaced, and removed without leaving the site (no hosted-checkout redirect / billing portal):

- `POST /billing/payment-method/setup` → returns a SetupIntent `clientSecret` for the provider's embedded card element (Stripe Payment Element). Ensures a provider customer first, creating + recording one for a pay-as-you-go user who has never purchased.
- `PUT /billing/payment-method` `{ paymentMethodId }` → after the client confirms the SetupIntent, makes the card the customer's default and records the consented card. The provider verifies the card is attached to THIS customer and rejects otherwise (`INVALID_PAYMENT_METHOD`).
- `DELETE /billing/payment-method` → detaches the card from the customer and clears the stored record.

New optional `IBillingProvider` methods (implemented by `StripeProvider`): `createSetupIntent`, `setDefaultPaymentMethod` (ownership-checked), `detachPaymentMethod` (ownership-checked). Absent-provider routes answer 501. No breaking changes; no new tables.
