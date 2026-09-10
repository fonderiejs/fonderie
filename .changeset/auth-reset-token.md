---
"@fonderie/auth": minor
---

Add a high-entropy reset-token path alongside the 6-digit reset PIN. Forgot-password now also mints a 32-byte token (stored beside the pin) and emits it — plus a ready-built `resetUrl` when the new `config.passwordResetUrl` base is set — in the `password-reset` notification payload, so a template can offer a click-to-reset link instead of only the code. `POST /auth/email/reset` accepts `{ token, password }` or `{ pin, password }`; the token is looked up directly and, being non-brute-forceable, needs no rate limit (the pin path keeps its IP limiter). Blank/short tokens are refused before the query so a NULL token column can never be matched. Purely additive: with `passwordResetUrl` unset, behaviour is unchanged (pin only, `resetUrl` empty). Ships migration `015_password_reset_token` (re-adds the nullable `token` column + a partial unique index).
