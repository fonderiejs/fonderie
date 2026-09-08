---
'@fonderie/auth': patch
---

Fix: logout now revokes the current session by its `sid`, not only by a resent refresh token. Because clients typically persist only the access token, `POST /auth/logout` previously received no refresh token and deleted nothing — the session row survived logout (lingering in `GET /auth/sessions`) and its refresh token stayed valid until expiry. Logout runs under `requireAuth`, so the access token's `sid` already identifies the session; it is now deleted directly, which also invalidates that access token via the existing sid-liveness check. An explicitly-passed refresh token is still honoured.
