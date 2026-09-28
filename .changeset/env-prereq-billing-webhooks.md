---
'@fonderie/billing': minor
---

Readiness now reports a missing webhook secret. When payments are enabled and `config.webhookSecret` is unset, `WEBHOOK_SECRET_MISSING` is raised; when a wallet is configured without `config.wallet.webhookSecret`, `WALLET_WEBHOOK_SECRET_MISSING` is. Before, the only signal was a 500 on Stripe's first delivery, after which subscriptions and pack purchases silently never synced. Both are warnings, so no deployment stops booting.

`new StripeProvider(secretKey, options)` is now accepted. The second positional `webhookSecret` argument was never used — signatures are verified with the BillingModule config — and that form is deprecated. The README and quickstarts set `webhookSecret` from `STRIPE_WEBHOOK_SECRET` and name the wallet one `STRIPE_WALLET_WEBHOOK_SECRET`.
