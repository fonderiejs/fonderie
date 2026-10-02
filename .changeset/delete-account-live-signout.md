---
'@fonderie/auth': minor
---

**Deleting an account signs out its other devices straight away.** `DELETE /users` now ends every session and emits `fonderie.session.revoked` with `{ sids: null, reason: 'account-deleted' }`, the same live sign-out a password change uses.

Before, the user's other devices stayed signed in until their next request failed, and nothing told them why. `ISessionRevokedEvent['reason']` gains `'account-deleted'`.
