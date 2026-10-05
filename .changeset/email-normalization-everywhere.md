---
'@fonderie/auth': patch
'@fonderie/rate-limit': minor
---

Every place that matches a typed email to an account now uses the same rule
accounts are stored under (`normalizeEmail`: lowercase, `+tag` dropped).

- **Login / password-reset limits:** the per-account bucket was keyed on the
  lower-cased address, so `jane+1@`, `jane+2@`… — all the same account — each got
  a fresh bucket, walking past the 5-per-15-min login limit and the
  3-per-hour reset-email limit. `byBodyField` takes an optional `normalize`, and
  auth passes `normalizeEmailSafe`.
- **`importUser`:** stored the address lower-cased only. An imported
  `Jane+Legacy@x.com` could never sign in (sign-in looks up `jane@x.com`), and the
  base address could register a second account beside it. It is now stored
  normalized; a value that is not an address is refused.
- **Console user search** (`GET /_admin/users?email=`) finds the account from the
  address as the user typed it.
- **Login history:** a replayed Google/Apple token records the normalized address,
  like every other login event.
