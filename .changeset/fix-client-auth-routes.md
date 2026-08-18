---
"@fonderie/client": minor
---

fix(client): align the auth/users surface with @fonderie/auth routes

The client had drifted from the server's actual routes, so several auth and
user flows failed. Audited every client module against its package; **workspaces,
billing, and customers already matched** — auth did not. Corrected:

**Fixed drifted endpoints**
- `verifyEmail` → `POST /auth/verify` `{ token }` (was `/auth/email/verify` `{ pin }`); now sends the auth token (route is `requireAuth`).
- `sendVerificationEmail` → `GET /auth/send-verification` (was `POST /auth/email/send-verification`).
- `resetPassword` input → `{ pin, password }` (was `{ resetToken, password }`).
- `mfa.disable` body → `{ token }` (was `{ code }`; server validates `mfaTokenSchema`).

**Replaced the nonexistent `PUT /users/update`** (`updateUser`/`IUpdateUserInput` removed) with the server's dedicated routes:
- `updateProfile` → `PUT /users/profile`, `updatePreferences` → `PUT /users/preferences`,
  `updateEmail` → `PUT /users/email`, `updatePhone` → `PUT /users/phone`,
  `changePassword` → `PUT /users/password`.

**Added missing endpoints**
- `exportData` → `GET /users/export` (SAR bundle).
- `mfa.regenerateBackupCodes` → `POST /auth/mfa/backup-codes`.

**Removed dead code**
- `AuthClient.phone` / `PhoneClient` (`/auth/phone/*` — not registered by `@fonderie/auth`).

BREAKING (types only; the removed members targeted routes that returned 404):
`updateUser`, `IUpdateUserInput`, `client.auth.phone`, and `IPhoneVerifyResult`
are removed. Aligns the client with the battle-tested crewfinding backend contract.
