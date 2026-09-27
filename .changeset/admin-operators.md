---
'@fonderie/admin': minor
'@fonderie/client': minor
'@fonderie/react-admin': minor
'@fonderie/vue-admin': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/cli': minor
---

Operator accounts for the admin console: people sign in with email, password and a mandatory authenticator app instead of pasting a token.

A token is a shared secret with no name on it — pasted into chat, saved in notes, logged as "admin-token". With a `store`, `@fonderie/admin` now has operators:

- **No registration.** The first operator is claimed once with the root `adminToken`; every other one is invited by an Owner through a single-use, expiring link. Operators live in their own table — an app sign-up or an app account takeover can never produce one.
- **Mandatory second factor.** RFC 6238 codes with a replay guard, QR enrollment, ten single-use backup codes shown once. Secrets sealed at rest with the new `operatorKey` (64 hex).
- **Step-up.** Revealing a secret, minting a token or link, applying a migration and deleting need a code from the last five minutes; the console prompts and retries the action.
- **Sessions.** HttpOnly SameSite=Strict cookie (`__Host-` over HTTPS), 30 min idle / 12 h absolute, rotated at every privilege change, same-origin writes only. Lockout after 5 failures plus a per-address limit; generic errors.
- **Recovery without email.** Backup codes, a recovery link from another Owner, or the root token from the terminal (`fonderie admin operator recover <email>`) as the break-glass.

`adminToken` remains the machine credential and the break-glass. `operators: false` keeps the token gate. New client methods on `AdminClient` (`session`, `login`, `verify`, `stepUp`, `inviteOperator`, …, and `adminToken` is now optional for cookie use), hooks `useAdminSession` / `useAdminOperators` (React and Vue), an Operators page in both screen packages, and `fonderie admin operator invite|recover|disable|enable`.
