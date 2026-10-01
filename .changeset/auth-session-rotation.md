---
'@fonderie/auth': minor
---

Sessions are now devices, with safe refresh rotation. This is Phase 2 of `docs/SESSION-DESIGN.md`.

- **Refresh tokens are hashed at rest** (SHA-256 in `fonderie_sessions.token`), so a database dump no longer contains working refresh tokens. Sessions from before this release keep their raw token until their next refresh hashes them; idle ones expire within the session lifetime.
- **One row per device:** a refresh rotates the same row and keeps its session ID, so "logged-in devices" stays stable. It tracks `last_used_at`.
- **Grace for retries and races:** the previous token stays valid for 30 seconds, so a retried or racing refresh succeeds instead of signing the user out.
- **Reuse detection:** the previous token presented *after* the grace means someone else holds an old copy. The session is revoked and `fonderie.session.revoked` is emitted (`{ userId, sessionId, reason: 'refresh-reuse' }`).
- **Every token carries a `jti`.** With a stable session ID, two tokens issued in the same second were byte-identical.

**Deploy note: migrate, then deploy.** Migration `020` only **adds** columns, which the previous code ignores, and the new code needs them. It deliberately doesn't hash existing rows: the previous code, still serving during a deploy, looks sessions up by the raw token, so hashing them in the migration would fail every refresh and sign users out until the new code is live.

Tested against a real Postgres in CI (`AUTH_PG_URL`). The rotation, the 30-second grace, 5 concurrent refreshes, reuse revocation, legacy rows hashed on their next refresh, and a migration that leaves raw rows readable for the previous code each have a test; the hashing and reuse tests were checked to fail when their feature is removed.
