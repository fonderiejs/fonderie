---
"@fonderie/auth": patch
---

Hash the password-reset PIN and token at rest. They were stored plaintext, so a DB read (SQLi elsewhere, a backup/log leak) yielded directly-usable reset credentials within the 1h window. Both are now stored as their SHA-256 hash and looked up by hash; the reset email still carries the raw values, only storage changed. SHA-256 is sufficient — the token carries 256 bits of entropy and the pin's protection is its route rate-limiter + short TTL + all-session-revoke. In-flight resets created before upgrade won't verify (users re-request); no data migration needed.
