---
'@fonderie/config': minor
---

`rotateSecretKey(store, from, to)` — re-encrypt every stored secret onto a new key.

Until now `CONFIG_SECRET_KEY` was permanent. Stored values are AES-GCM
ciphertext under it, so changing the key made every secret undecryptable and
losing it made them unrecoverable — a one-way door on a routine operational task
(a leaked key, someone leaving, an annual rotation policy).

**Revisions are re-encrypted too, and that is the point.**
`fonderie_secret_revisions.value` holds ciphertext as well. A rotation touching
only `fonderie_secrets` would appear to work — every reveal would succeed — and
would quietly destroy every rollback target, surfacing much later as
`rollbackSecret()` restoring a value encrypted under a key nobody still has.

Failure behaviour, because a half-rotated table is unrecoverable once the old
key is gone:

- one transaction, with `FOR UPDATE` on both tables so a concurrent `setSecret()`
  cannot write under the old key mid-rotation
- every value is decrypted and re-encrypted **in memory before anything is
  written**, so a wrong `from` key aborts having changed nothing
- the error names the offending row rather than surfacing a bare
  "unable to authenticate data"
- not idempotent by design: a second run with the same pair refuses, rather than
  double-encrypting

Deliberately a library call, not an admin route — rotating needs the *new* key,
and putting a fresh master key in a request body sends it through every log and
proxy in front of the surface.

```ts
await rotateSecretKey(
  store,
  createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY_OLD!),
  createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY!),
); // → { secrets: 12, revisions: 47 }
```
