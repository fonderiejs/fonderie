---
"@fonderie/client": minor
---

Add an optional per-call `token` to `IRequestConfig` (and `get`/`post`/`put`/`patch`/
`delete`), overriding the client's stored Bearer for a single request. Enables flows
that authenticate with a temporary token before the session exists — e.g. MFA login
(`POST /auth/mfa/verify` with the `mfaToken`) — without dropping to raw HTTP.
