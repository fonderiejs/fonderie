---
"@fonderie/auth": minor
---

Rate-limit password reset. `POST /auth/email/reset` verifies a 6-digit PIN that is looked up globally, so an unthrottled endpoint was brute-forceable into an account takeover. The route now carries a per-IP limiter (10 / 15 min by default), on by default like login and forgot-password, and configurable/disable-able through `config.rateLimit.rules.reset`. Adds `reset` to `AuthLimitedRoute`. (Moving the reset flow to a high-entropy opaque token is tracked as a follow-up.)
