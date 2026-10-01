---
'@fonderie/auth': minor
---

Sessions now behave like a messaging app's: an idle device stays signed in. This is Phase 3a of `docs/SESSION-DESIGN.md`.

- **Idle timeout 7 d → 90 d (sliding).** Each refresh extends it. Security comes from revocation (logged-in devices, reuse detection), not from expiry. Set `sessionDuration` to keep the old behaviour.
- **Access tokens 24 h → 1 h.** They're refreshed silently, so a stolen one is useful for at most an hour. Set `accessTokenDuration` to change it.
- **Optional absolute cap, `sessionMaxAge`** (e.g. `'365d'`, console key `auth.session.max_age`). A session that old is refused at its next refresh and revoked, however active it is.
- **`auth_time` claim:** when the user last actually signed in. A sign-in sets it and a refresh carries it, ready for "re-authenticate for sensitive actions" (Phase 3b).
- **Fix:** a refresh now uses the console-resolved config. Before, `auth.session.duration` set in the console applied at sign-in but was ignored at every refresh.

**Behaviour change:** apps that relied on the defaults get longer sessions and shorter access tokens. Clients that refresh on 401 (`@fonderie/client` does) need no change.
