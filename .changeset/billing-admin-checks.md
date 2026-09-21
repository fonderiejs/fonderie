---
'@fonderie/billing': minor
---

Offer price consistency, subscription drift and webhook registration to the doctor

`describeAdmin().checks` wraps `checkPriceConsistency`,
`checkSubscriptionDrift` and `checkWebhookRegistration` for `@fonderie/admin`.
A provider without the read-back seam reports the check as skipped, not
failed.

New optional `config.publicUrl` — where this API is reachable from the
internet, basePath included — because the registration check compares by
exact URL and must never guess from a per-deployment hostname. Unset ⇒ that
check is skipped and says so.
