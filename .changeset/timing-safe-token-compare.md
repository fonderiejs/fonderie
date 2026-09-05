---
'@fonderie/auth': patch
'@fonderie/courier': patch
---

Constant-time secret comparisons everywhere a secret is compared

An audit of every token/secret equality check found two spots still using
plain string comparison while config and billing already use
`crypto.timingSafeEqual`: courier's template-admin Bearer guard compared
`token !== adminToken` (its comment claimed to mirror config's admin
surface, but the mirror missed the constant-time compare), and auth's TOTP
verification compared the six-digit code with `===`. Both now use the same
length-guarded `timingSafeEqual` pattern, closing the response-timing oracle
that would let an attacker recover a match byte-by-byte. No behavior change
for correct or incorrect credentials.
