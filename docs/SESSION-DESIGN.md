# Sessions that behave like WhatsApp's — design and build order

Status: Phase 1 shipped in `@fonderie/auth` (key ring); Phases 2–6 planned (2026-10-01).

## 1. The problem

Messaging and social apps (WhatsApp, Instagram, Messenger, Snapchat) almost
never ask a user to sign in again. Ours did, and worse, it sometimes *looked*
signed in while it was not:

- Rotating `JWT_SECRET` (2026-09-30) invalidated every token at once. Phones
  kept showing signed-in screens with dead tokens; the live stream silently
  opened anonymous; the next API call signed the user out mid-use.
- A user who does not open the app for 7 days is signed out (refresh token
  lifetime), though nothing about their account or device changed.

## 2. Audit (what the code does today)

| Area | Today | Gap |
|---|---|---|
| Signing key | one `jwtSecret`, HS256, no key id | rotating it signs everyone out; no overlap |
| Access token | JWT, 24 h, bound to a session row (`sid`) — revocable | fine; shorter is better once refresh is silent |
| Refresh token | JWT, 7 d, rotated on each use (delete row + insert row) | 7 d idle ⇒ signed out; device identity changes each rotation |
| Refresh at rest | `fonderie_sessions.token` holds the **raw** token | a database dump contains working refresh tokens |
| Refresh reuse | an old token is refused (row gone) | no theft signal: the session survives; two racing refreshes sign a real user out |
| Devices | `GET /auth/sessions`, terminate one / others — exists | revocation reaches the phone only on its next request |
| Sensitive actions | password etc. behind the normal session | no "recently authenticated" requirement (step-up) |
| App: signed-in state | `!!user.id` from the persisted profile (AsyncStorage) | UI says signed in regardless of the session |
| App: token storage | SecureStore (Keychain / Keystore) — **twice** (redux `tokens` + react-native-auth) | two copies can drift |
| App: platform | default SecureStore options | iOS Keychain survives uninstall; Android Auto Backup can restore undecryptable data |

## 3. Target

```
 sign in once per device ─► DEVICE SESSION (row = device; months, sliding)
        │                        • refresh token hashed at rest, rotated on use
        │                        • reuse of an old token ⇒ session revoked
        │                        • listed under "logged-in devices"
        ▼
 short access token (≤ 1 h), refreshed silently; signed with a KEY RING
   (kid header; previous keys still verify during rotation ⇒ nobody notices)
        │
 app's "signed in" = the session's state, confirmed in the background:
   network failure ─► stay signed in (offline-first)
   definitive refusal (revoked / expired) ─► sign out once, with a message
        │
 revocation pushed live: fonderie.session.revoked over the authenticated
   stream ⇒ "sign out this device" lands within a second
 sensitive actions ⇒ step-up (recent auth; Face ID / fingerprint on device)
```

## 4. Phases

**Phase 1 — Key ring (server, `@fonderie/auth`).** ✅ Sign with the current
secret and a `kid` header (derived from the secret, no extra config); verify by
`kid` against `[jwtSecret, ...jwtPreviousSecrets]`; tokens without a `kid`
(issued before) try each. Rotation runbook: move the old secret to
`JWT_PREVIOUS_SECRETS`, set the new `JWT_SECRET`, deploy; drop the old one
after the longest token lifetime. Readiness: previous secrets meet the same
strength rules. *Prevents the 2026-09-30 mass sign-out.*

**Phase 1b — Auth-managed key ring.** Auth owns its signing keys instead of
the deployment: a `fonderie_auth_keys` table (kid, secret sealed with one
master key from env, created_at, retires_at); rotation from the console
("Rotate signing key") or on a schedule, with no redeploy; keys retire
themselves after the longest session lifetime; every instance shares the ring
through the database. Phase 1's env secrets stay supported for apps that
prefer them. Removes rotation chores from app deploy tooling.

**Phase 2 — Session store hardening (server).** Refresh tokens hashed at rest
(SHA-256; migration hashes existing rows). One row per device, kept across
rotations (update the hash, `last_used_at`; `id` stable). Keep the previous
token's hash with a short grace (30 s) so two racing refreshes both succeed;
a reuse *after* the grace revokes the session (theft signal) and emits
`fonderie.session.revoked` (reason `reuse`).

**Phase 3 — Long-lived sliding sessions (server).** Session idle timeout
(default 90 d since last use) plus an optional absolute cap; access token
default shortened (1 h). Both remain configurable, including from the
console's auth config keys. Step-up: an `auth_time` claim and a
`requireRecentAuth(minutes)` guard for password/email/MFA/account deletion.

**Phase 4 — Client and app.** A session state in the client
(`signedOut | active | offline | revoked`) that the hooks expose; a 401 after a
failed refresh is *definitive*, a network error is not. The app derives
"signed in" from it, validates in the background at start (never blocking the
first render), signs out once with a message on a definitive refusal, keeps
one token store, clears Keychain tokens on the first launch after a reinstall
(iOS), excludes SecureStore from Android Auto Backup.

**Phase 5 — Live revocation.** `fonderie.session.revoked` in auth's event
catalog (audience: the user); terminate-device, password change, reuse
detection and suspension emit it; the client signs out within a second over
the stream it already holds.

**Phase 6 — Device unlock (optional).** Face ID / fingerprint as the step-up
on the device, and optionally an app lock on resume.

## 5. Decisions

- HS256 stays (one service signs and verifies); asymmetric keys / JWKS only
  when a second service must verify without the secret.
- `kid` = first 16 hex chars of SHA-256(secret): stable, needs no config,
  reveals nothing usable.
- Defaults are conservative; every lifetime is configurable.
