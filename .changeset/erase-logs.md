---
'@fonderie/courier': minor
'@fonderie/events': minor
'@fonderie/webhooks': minor
---

Account deletion now reaches the logs. Each of these bricks ships an `accountEraser(store)` for the account purge to run before the user row goes, so a deleted person's email, phone and name stop living on in places nothing else cleaned up.

- **courier**: message-log rows sent to the person's email (any case, any `+tag`) or phone keep their delivery statistics, but the recipient — and any error or bounce text, which often quotes the address — becomes `'erased'`.
- **events**: notifications addressed to the person are deleted (they hold one-time codes and reset links), including those sent to addresses the account had before, but only for the time each was theirs, because a freed address may now belong to someone else. Every other event that names them is redacted with the opaque user id kept, so the security trail survives, and re-signed with `integrityKey` so the integrity check still reads it as intact. Before re-signing, the eraser checks the row's current signature, so erasure can never hide tampering. It refuses, and the purge retries, while a notification to the person is still being delivered.
- **webhooks**: delivery payloads and echoed response bodies that name the person are redacted; the delivery record itself is kept.

Each eraser is idempotent and reports how many rows it touched and what it deliberately kept.
