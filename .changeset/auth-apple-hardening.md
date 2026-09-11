---
"@fonderie/auth": minor
---

Security hardening for Sign in with Apple (post-audit; SOC2-oriented — no
Critical/High findings, these close the Medium/Low items).

- **Native replay protection (single-use tokens):** a verified native
  `identityToken` (POST /auth/apple/native) is now redeemable exactly once —
  consumed by hash with TTL = the token's own exp (new `fonderie_consumed_tokens`
  table, atomic INSERT … ON CONFLICT). Apple doesn't one-time the id_token for
  us, so this stops a captured token from being replayed until it expires. A
  replay is recorded as an `oauth-apple` failed-login security event. Non-breaking:
  the optional client `nonce` remains supported for session-binding but is not
  required. New migration `016_consumed_tokens.sql`.
- **JWKS fetch hardening:** the Apple public-key fetch is now single-flighted,
  rate-limited to at most one refetch per minute (so a flood of attacker-chosen
  `kid`s can't force one outbound call to Apple per request), and bounded by a
  5s timeout.
- **Rate-limited web callbacks:** `POST /auth/apple/callback` and
  `GET /auth/google/callback` now carry the login IP limiter (an unauthenticated
  caller could otherwise force one outbound token-exchange per request).
- **Account linking:** OAuth link now sets `email_verified_at` on the
  conflict/link branch (`COALESCE(existing, now())`) so an existing unverified
  account linked via a provider that asserts a verified email is marked verified.
- **Config guard:** `apple.nativeClientIds` with an empty or wildcard entry is
  now a boot-blocking error (it's the native-audience allow-list; a wildcard
  would accept identity tokens minted for other apps).
