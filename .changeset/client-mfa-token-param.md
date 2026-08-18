---
"@fonderie/client": patch
---

refactor(client): name MFA params `token` to match the wire field

`mfa.verify` / `mfa.disable` / `mfa.regenerateBackupCodes` now take a `token`
parameter and send `body: { token }` directly, instead of mapping a `code`
param onto `{ token: code }`. No behavior change — the request is identical.
