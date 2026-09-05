---
'@fonderie/billing': minor
---

Phase 3a: refund/chargeback wallet clawback — closes the value-leak where a buyer could purchase credits, spend them, then refund the card (or file a chargeback) and keep the goods

The Stripe provider now normalizes `charge.refunded` and `charge.dispute.created` / `.closed` into a new `IBillingEvent.reversal` (`INormalizedReversal`), and the payment webhook reverses the credits the original purchase granted:

- A refund/chargeback carries no wallet metadata, so billing joins back to the purchase by its PaymentIntent (`provider_tx_id`, now indexed via migration `007`). New helpers: `reverseWallet`, `findPurchaseByProviderTxId`, `sumReversedCreditsByProviderTxId`, `findLedgerAmountByKey`.
- The reversal is a negative `type:'refund'` ledger row that **deliberately bypasses the balance floor** — a clawback must be able to drive the wallet negative when the credits were already spent (a negative balance is "credits owed back"; the next grant/purchase nets against it).
- Credits are prorated to the refunded amount and the **cumulative reversal is capped at the credits granted, enforced inside the transaction under a per-PaymentIntent advisory lock**, so no mix of partial refunds and a chargeback — even delivered concurrently — can ever over-reverse.
- Idempotent on the refund's/dispute's own id (a charge can be partially refunded many times, each distinct). A won dispute restores exactly what its chargeback clawed.
- Emits `fonderie.billing.payment.refunded` + `fonderie.billing.wallet.debited` and the (previously reserved) `billing.refund-processed` customer notice — only on a real, non-replayed reversal.

`SubscriptionStatus` is widened to the full provider vocabulary (adds `incomplete_expired`, `unpaid`) — the DB column is already free-form text, so this only makes the type honest; the new states are inactive by default.

Additive and opt-in: the new event slot and helpers don't affect existing flows, and refunds only act when the provider normalizes them. Proven against real PostgreSQL (negative-balance clawback, idempotent replay, and the concurrent dispute+refund cap). The remaining Phase 3 items — `invoice.paid`/`invoice.payment_failed` and `checkout.session.async_payment_failed`/`payment_intent.payment_failed` normalization (notification-only) — land in a follow-up.
