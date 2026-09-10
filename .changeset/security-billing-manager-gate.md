---
"@fonderie/billing": major
---

Money-mutating billing routes now require a workspace manager (BREAKING for workspace-scoped billing). `withBilling` verifies *membership*, so any member could spend the workspace's saved card, start checkouts, buy wallet credits, change auto-recharge preferences, or cancel the subscription. Checkout, portal, subscription cancel/reactivate, payment-method setup/save/remove, and wallet checkout/purchase/preferences now additionally require the caller to be the workspace **owner** or hold an **active system role**, via the new exported `requireBillingManager` middleware (fail-closed, same cross-module data-dependency pattern as the existing membership check). Reads (subscription, invoices, wallet, usage) and usage recording are unchanged, and **user-scoped billing is never gated** — a user always manages their own money. Restore the legacy behaviour with `management: 'any-member'` in the billing config.
