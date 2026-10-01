---
'@fonderie/auth': minor
---

Sessions are now devices, with safe refresh rotation. This is Phase 2 of `docs/SESSION-DESIGN.md`.

- **Refresh tokens are hashed at rest** (SHA-256 in `fonderie_sessions.token`), so a database dump no longer contains working refresh tokens. Migration `020` hashes existing rows. Lookups also accept a raw value, for rows written before it.
- **One row per device:** a refresh rotates the same row and keeps its session ID, so "logged-in devices" stays stable. It tracks `last_used_at`.
- **Grace for retries and races:** the previous token stays valid for 30 seconds, so a retried or racing refresh succeeds instead of signing the user out.
- **Reuse detection:** the previous token presented *after* the grace means someone else holds an old copy. The session is revoked and `fonderie.session.revoked` is emitted (`{ userId, sessionId, reason: 'refresh-reuse' }`).
- **Every token carries a `jti`.** With a stable session ID, two tokens issued in the same second were byte-identical.

**Deploy note: run migrations before the new code.** Refresh writes the new columns.

Tested against a real Postgres in CI (`AUTH_PG_URL`). The rotation, the 30-second grace, 5 concurrent refreshes, reuse revocation and the migration on legacy rows each have a test; the hashing and reuse tests were checked to fail when their feature is removed.
