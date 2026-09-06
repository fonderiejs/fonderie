---
'@fonderie/auth': minor
---

Ship default email/SMS templates for every auth notification (P1 of the notification-template normalization).

`@fonderie/auth` now exports `DEFAULT_TEMPLATES` — built-in copy for all nine message keys (`email-registration`, `email-verification`, `password-reset`, `phone-otp` (SMS, text-only), `mfa-enabled`, `mfa-disabled`, `mfa-backup-codes-regenerated`, `email-changed`, `phone-changed`). Pass it to courier via `config.templates.defaults` and auth's notifications render out of the box — no per-app template authoring, and never the raw-JSON fallback. Any single key is still overridable per-app with a DB row / FS file.

The map is `satisfies Record<AuthMessageKey, IDefaultTemplate>`, so adding a message key without a default is a compile error. A coverage test asserts every key's default renders cleanly with its real payload (no variable/payload drift, no unresolved `{{…}}`), and that the map is assignable to courier's `DefaultTemplateMap` (the app-wiring contract). Requires `@fonderie/core >= 0.8.0` and `@fonderie/courier >= 5.2.0` (the default-template mechanism). Additive — no behavior change for apps that don't wire `templates.defaults`.
