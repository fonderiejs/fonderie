---
'@fonderie/billing': minor
---

Make the in-app card-save SetupIntent's offered payment methods configurable, defaulting to card only. `StripeProvider` takes a new optional third argument `{ setupPaymentMethodTypes }` (typed via the exported `SUPPORTED_PAYMENT_OPTIONS` const / `SupportedPaymentOption` union), and `createSetupIntent` uses it instead of `automatic_payment_methods`.

This fixes a bug where a subscriber whose email Stripe recognized for **Link** would save a `type:'link'` payment method — which has no `card` object, so `getPaymentMethod` couldn't render or read it back, and the card appeared lost on refresh. The default `[SUPPORTED_PAYMENT_OPTIONS.CARD]` guarantees a concrete, displayable, off-session-chargeable card that stays on-page. Consumers who want wallets can opt in (e.g. `[SUPPORTED_PAYMENT_OPTIONS.CARD, SUPPORTED_PAYMENT_OPTIONS.LINK]`), accepting that non-card methods won't display as a card on file. The policy lives in the consumer's provider config, not hard-coded in the brick.
