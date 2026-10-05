---
'@fonderie/auth': minor
'@fonderie/workspaces': patch
---

A deleted account is ARCHIVED for its grace period, and now behaves like it
(account-deletion design, Phase 1 — docs/ACCOUNT-DELETION-DESIGN.md).

- **Signing in** to an archived account with the right password, or a verified
  Google / Apple identity, answers `403 ACCOUNT_PENDING_DELETION` with
  `details.requestedAt` and `details.deleteOn`, so an app can say when it will be
  deleted. A wrong password is still the plain `401 INVALID_CREDENTIALS` — no
  account-existence oracle. (Phone sign-in follows in Phase 2, with restore.)
- **Signing up** again with the address or phone of an archived account answers
  `409 ACCOUNT_PENDING_DELETION` instead of a 500 — and no longer rewrites the
  archived account (phone sign-up overwrote its name; Google / Apple sign-in
  rewrote its provider fields, then failed).
- **Reset and verification codes** issued before the deletion stop working: they
  are removed when the account is archived, and a reset never applies to an
  archived account.
- New `accountDeletion.gracePeriodDays` (default 30) dates the deletion; purge
  with the same number.
- **Workspaces:** a member whose account is deleted is no longer listed (name,
  email, photo) or counted as a seat; restoring the account brings them back.
