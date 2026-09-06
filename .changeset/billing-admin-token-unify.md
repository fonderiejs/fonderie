---
'@fonderie/billing': minor
---

Unified admin token + per-type notification toggles (both additive, non-breaking).

**One admin token for all billing ops routes.** New top-level `config.adminToken` guards *both* the DB-plan write API (`POST/PUT/DELETE /plans`) and the wallet manual-grant (`POST /billing/wallet/grant`), each still registered only when a token is available (unset ⇒ 404). The per-surface tokens `config.planAdminToken` and `config.wallet.adminToken` are now **deprecated** but still honored as fallbacks (`config.adminToken ?? <legacy>`), so existing configs keep working — set `config.adminToken` going forward. A plan token never cross-enables the wallet-grant route (and vice versa).

**Opt out of the informational emails.** `IBillingNotificationsConfig` gains `creditsLow?` and `trialEnding?` (both default on). Setting either to `false` suppresses that customer EMAIL while the durable domain event still fires. The mandatory money-movement notices (payment receipt, renewal receipt, refund, failed payment) and account-state notices (cancellation, auto-recharge failure) remain unconditional — there is deliberately no toggle for them, per the governing principle.
