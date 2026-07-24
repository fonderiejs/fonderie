---
"@fonderie/courier": minor
---

Seed the remaining transactional templates so every message type the SDK emits
has a production-grade default. Adds `email-registration` (the signup
confirmation — the first email a new account receives), the four MFA/phone
security notices (`mfa-enabled`, `mfa-disabled`, `mfa-backup-codes-regenerated`,
`phone-changed`), and the `phone-otp` SMS template (text-only, no shell). All
ten emitted types (auth + workspaces) are now covered; none fall through to the
raw-JSON debug fallback. Validated + idempotent against Postgres 16.
