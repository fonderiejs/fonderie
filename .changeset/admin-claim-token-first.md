---
'@fonderie/admin': patch
---

Zero-config operator onboarding. First-time setup is a guided flow with a progress bar — admin token → your account → authenticator → backup codes (invite and recovery links show the last three). The admin token is asked for alone and checked against the server before the account form appears. `operatorKey` no longer raises a readiness warning when unset — it is optional hardening (encrypts authenticator secrets at rest against a database leak), not a required second environment variable; a leaked authenticator secret still needs the operator's scrypt-hashed password. A malformed key is still an error.
