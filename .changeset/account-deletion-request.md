---
'@fonderie/auth': minor
'@fonderie/billing': minor
'@fonderie/workspaces': minor
'@fonderie/client': minor
'@fonderie/react-auth': minor
'@fonderie/react-native-auth': minor
'@fonderie/vue-auth': minor
---

Deleting an account now takes proof and can be undone until the purge
(docs/ACCOUNT-DELETION-DESIGN.md, Phase 2).

- **Request with a code** — `POST /users/me/deletion { channel: 'email' | 'sms' }`
  sends a 6-digit code (15 min, one per minute, five tries) to that address;
  `POST /users/me/deletion/confirm { code, mfaCode? }` archives the account in one
  statement (closed, every session and pending code gone) and sends "your account
  will be deleted on …" on the same channel. Two-factor accounts also give a
  second factor. `DELETE /users` still works and is deprecated.
- **Keep my account** — signing in to an archived account (password, Google /
  Apple, or phone code) answers `403 ACCOUNT_PENDING_DELETION` with `requestedAt`,
  `deleteOn`, `mfaRequired` and a 10-minute `restoreToken`;
  `POST /auth/account/restore { restoreToken, mfaCode? }` un-archives it and signs
  in. Phone sign-in to an archived account now sends its code and offers the same.
- **Not while owning a team** — `accountDeletion.blockers`; `@fonderie/workspaces`
  ships `accountDeletionBlocker(store)`: refused (`409 OWNS_TEAM_WORKSPACE`) while
  the person owns a workspace other people belong to.
- **Billing** — on deletion the default is now `cancel-at-period-end` (was
  `cancel`): nothing more is charged and keeping the account resumes it
  (`fonderie.user.restored`). A cancellation the person chose is never undone.
- **One-time codes are spent once under a race** — a backup code (MFA sign-in,
  and the new second-factor checks) and a password-reset code could each be used
  twice by concurrent requests; both are now spent atomically.
- **Client** — `auth.requestAccountDeletion / confirmAccountDeletion /
  restoreAccount`, `pendingDeletionOf(err)`; hooks `useAccountData().requestDeletion
  / confirmDeletion` and `useRestoreAccount` (React, React Native, Vue); messages
  for `OWNS_TEAM_WORKSPACE` and `RESTORE_TOKEN_INVALID` in five languages.

**Apps:** run migrations before deploying (auth `022`, billing `016`, additive);
route `account-deletion-code`, `account-deletion-scheduled` and `account-restored`
to `['email', 'sms']` in courier; wire `accountDeletion: { gracePeriodDays,
blockers: [accountDeletionBlocker(store)] }`.
