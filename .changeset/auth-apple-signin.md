---
"@fonderie/auth": minor
---

Sign in with Apple — a second OAuth provider alongside Google, wired behind
`providers: ['apple']`. Required for App Store apps that offer any third-party
login (Apple Guideline 4.8).

- **Config:** `apple?: { clientId (Services ID), teamId, keyId, privateKey (.p8),
  redirectUri, nativeClientIds? }`. The client secret is not a static string —
  it's a short-lived **ES256 JWT** minted from the `.p8` key per token exchange.
- **Web flow:** `GET /auth/apple` → Apple → `POST /auth/apple/callback`
  (`response_mode=form_post`). The CSRF `state` cookie is `SameSite=None; Secure`
  (a `Lax` cookie — Google's — is not sent on Apple's cross-site POST).
- **Native (iOS) flow:** `POST /auth/apple/native` takes the `identityToken` from
  the native Apple sheet. Because that token's `aud` is the app's **bundle id**
  (allow-listed via `nativeClientIds`) and it did not come from our own TLS
  exchange, its signature is **verified against Apple's JWKS** — with `iss`, `aud`,
  `exp`, `email_verified`, and optional `nonce` all checked.
- Accounts link **by verified email** (`upsertByProvider`), reusing Google's
  account-linking posture; login history records `oauth-apple`. No DB migration
  (`provider` is already a free-form column).

All routes are config-gated — apps that don't set `apple` are unaffected.
