---
'@fonderie/billing': minor
---

Surface the Stripe card `fingerprint` on the provider-normalized card (`INormalizedCard.fingerprint`, mapped from `PaymentMethod.card.fingerprint`) as a raw server-side signal for app-level trial-abuse/fraud composition — storage, hashing, and retention remain the app's job. It stays server-side: `toPaymentMethodDTO` deliberately omits it, so no payment-method route ever returns it. Caveats for composers: wallet-tokenized cards (Apple Pay / Google Pay) may fingerprint the tokenized number rather than the underlying card, and `getPaymentMethod` is a tolerant fail-open lookup (null = unknown, not clean). Optional on the interface, so custom providers without an equivalent stay conformant. Also hardens `getPaymentMethod`'s consented-card branch with the ownership check its sibling writes already had — a stale detached id now falls through to the default/newest card.
