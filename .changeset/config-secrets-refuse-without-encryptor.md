---
'@fonderie/config': major
---

**Breaking:** without a `secretEncryptor`, the secrets admin surface now refuses
every request instead of handling plaintext.

`ConfigModule` substituted `noopEncryptor` when none was configured, so a
deployment with no key stored secrets in clear **and handed them back** over
`POST /admin/secrets/:key/reveal`.

`checkReadiness` was supposed to catch that, and could not. It escalated to a
production error only when this module had its **own** `adminToken`, reasoning
that otherwise "the surface isn't registered at all". That reasoning was wrong:
`describeAdmin()` is unconditional, so `@fonderie/admin` mounts these routes
under `/_admin` and reveals secrets regardless of this module's token. The
normal deployment shape — config brick with no token of its own, admin console
hosting it — was exactly the one the check waved through as a warning.

The check cannot detect an admin host: `enforceProductionReadiness()` runs
before any `install()`, and `describeAdmin()` is called from the admin module's
install. So this fixes the exposure rather than the label.

Now, with no encryptor:

- every `/secrets*` route returns `503 SECRETS_DISABLED`, naming the cause and
  the fix
- config entries are unaffected — they carry no secret material
- `checkReadiness` still reports the absence, as a warning that says what
  actually happens

The routes are still **described**, deliberately. Omitting them would hide the
console's page, and an operator who sees nothing learns nothing; a refusal that
names itself is a signal they can act on.

To keep the previous behaviour, pass `secretEncryptor: createAesGcmEncryptor(key)`
(`openssl rand -hex 32`). Passing `noopEncryptor` explicitly still works and
still stores plaintext — it is now a choice rather than a default.
