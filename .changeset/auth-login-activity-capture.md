---
'@fonderie/auth': minor
---

Capture login activity for security surfaces. `fonderie_sessions` now persists `ip_address` and `user_agent` on every session create (previously these columns existed but were always NULL — a bug that left the SAR export and any session UI blank). A new append-only `fonderie_login_events` table records one row per login attempt — success or failure — across the password, MFA, and Google-OAuth paths, with `method`, `outcome`, `failure_reason`, IP, and user-agent; `user_id` is nullable so attempts against unknown emails still record. Recording is fire-and-forget: a logging failure can never block or fail a login. This is the data layer for the forthcoming login-history and active-sessions read APIs; no new routes yet.
