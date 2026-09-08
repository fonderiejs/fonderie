---
'@fonderie/auth': minor
'@fonderie/client': minor
---

Read/manage APIs for login activity. `@fonderie/auth` adds four caller-scoped routes: `GET /auth/login-history` (the caller's own attempts, newest first, keyset-paginated on `(created_at, id)` — the same cursor contract as audit's event log, reused from `@fonderie/core`); `GET /auth/sessions` (live sessions, with the current one flagged via the request's `sid`); `DELETE /auth/sessions/:id` (revoke one session, scoped to its owner); and `DELETE /auth/sessions/others` (revoke every session except the current). Because access tokens are already bound to their session's `sid`, terminating a session revokes its access token on the next request, not just its refresh. `@fonderie/client`'s `AuthClient` gains `getLoginHistory`, `listSessions`, `terminateSession`, and `terminateOtherSessions`, sharing the existing auth token.
