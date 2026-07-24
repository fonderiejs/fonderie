---
"@fonderie/auth": minor
---

Add `legacyVerify` — rehash-on-login for apps migrating onto Fonderie auth. Set
`legacyVerify: (plain, hash) => boolean | Promise<boolean>` on the auth config to
validate a foreign password hash (argon2, scrypt, pbkdf2, a framework's format)
on login; on the first successful login Fonderie transparently re-stores the
password as bcrypt, so the legacy verifier runs at most once per migrated user.
Imported bcrypt hashes need no config — the built-in check already accepts them.
No behavior change unless `legacyVerify` is set.
