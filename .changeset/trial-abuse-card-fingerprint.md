---
'@fonderie/billing': minor
---

Surface the Stripe card `fingerprint` on the provider-normalized card (`INormalizedCard.fingerprint`, mapped from `PaymentMethod.card.fingerprint`). The fingerprint is stable per physical card across customers, which makes it the strongest server-side signal for app-level trial-abuse/fraud composition — and exactly why it stays server-side: `toPaymentMethodDTO` deliberately omits it, so the wire DTO still carries display fields only. Optional on the provider interface, so custom providers without an equivalent stay conformant.
