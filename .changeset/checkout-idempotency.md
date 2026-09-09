---
'@fonderie/billing': minor
'@fonderie/client': minor
'@fonderie/react-billing': minor
---

Idempotent subscription checkout. `POST /billing/checkout` now accepts an optional `idempotencyKey` (added to `checkoutSchema` so `validate` doesn't strip it, threaded into `StripeProvider.createCheckoutSession` as the Stripe idempotency key). `@fonderie/client`'s `ICheckoutInput` gains the field, and `@fonderie/react-billing`'s `useCheckout` generates a V4 UUID per attempt (mirroring `usePurchasePack`) — so a retried checkout dedupes to a single session (and one subscription) instead of a duplicate. Verified: same key → same Stripe session; different key → different session.
