---
"@fonderie/client": minor
---

Add `auth.mfa.verifyLogin(mfaToken, code)` — a typed method for the MFA-login step
(completing a login that returned `MFA_REQUIRED`). It sends the temporary `mfaToken`
as the bearer, so consumers no longer need the generic `post()` + per-call token for
this flow.
