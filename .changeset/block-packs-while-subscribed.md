---
'@fonderie/billing': minor
---

Add `config.wallet.blockPacksWhileSubscribed` (default `false`). When enabled, `POST /billing/wallet/checkout` is rejected with `409 PACKS_BLOCKED` for a subscriber on an **active or trialing paid plan** — a paid plan already includes its credits, so selling one-time packs on top would charge for something the subscription covers.

Declarative config, not a hook. Off by default, so the allowance + top-up shape is unchanged. Free / pay-as-you-go / unpriced plans are never blocked (a plan with no `monthly` or `yearly` price is treated as free), and a `past_due` subscriber is not blocked (they may top up while payment is retried).
