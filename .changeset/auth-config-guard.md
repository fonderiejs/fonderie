---
"@fonderie/auth": minor
---

Production-readiness guard: `AuthModule` now validates its config on construction
and **refuses to boot in production with a weak `jwtSecret`** (< 32 chars or a
placeholder/dev-default like `dev-secret-…`) — a forgeable token is an auth
bypass, so this fails closed. Outside production the same issues are a loud
warning, so dev/test are unaffected. Also warns on `secureCookies: false` in
production. Exported as `validateAuthConfig` for an app's own preflight.

Note: an app currently deploying with a weak secret in production will now fail
to boot — that deployment was already insecure; set a real secret
(`openssl rand -base64 32`).
