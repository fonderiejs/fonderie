---
"@fonderie/auth": minor
---

Security: access tokens are now revocable. Each token pair carries a `sid`
claim bound to its server-side session row (`fonderie_sessions.sid`, new
migration), and `withSession` rejects access tokens whose session has been
deleted — so logout, refresh rotation, and password change kill the access
token immediately instead of letting it live out its JWT expiry. New
`accessTokenDuration` config (default '24h') controls the access-token
lifetime. Legacy tokens without a `sid` (issued before this release, and
short-lived mfaPending tokens) still authenticate and age out naturally.
