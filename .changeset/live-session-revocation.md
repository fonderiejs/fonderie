---
'@fonderie/auth': minor
'@fonderie/client': minor
---

Live sign-out (Phase 5 of `docs/SESSION-DESIGN.md`): when a session is revoked, the device holding it signs out **within a second**, not on its next request.

- **Auth:** `fonderie.session.revoked` is declared in the event catalog. The audience is **only the user it's about**, and the event carries ids only: `{ sids, reason }`, where `sids: null` means every session. It's emitted when:
  - a device is signed out from the devices list (`terminated`);
  - all other devices are signed out (`terminated`);
  - the password changes (`password-changed`, all sessions);
  - an admin uses "sign out everywhere" (`admin`);
  - a refresh token is reused (`refresh-reuse`).
- **Client:** while signed in, and when `sse` is configured, it listens on the stream it already holds. If the event names **this device's session** (its `sid`) or all sessions, it clears the tokens and cache and calls `auth.onAuthError`. Another device's revocation never signs this one out. Apps without `@fonderie/sse` see no change; `liveSignOut: false` turns it off.
