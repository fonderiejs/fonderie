---
'@fonderie/workspaces': minor
'@fonderie/client': minor
---

Accepting an invitation now says WHY it failed, and a link only joins the
account it was sent to.

- Every refusal was `400 INVITATION_FAILED` with an English sentence, so apps
  told "expired" from "already used" by parsing text. Each now has its own
  reason: `INVITATION_NOT_FOUND` (404 — also a link replaced by a resend),
  `INVITATION_EXPIRED` (410), `INVITATION_REVOKED` (410), `INVITATION_ALREADY_USED`
  (409), `INVITATION_ROLE_UNAVAILABLE` (409), `INVITATION_EMAIL_MISMATCH` (403),
  and `NO_EMAIL_ON_ACCOUNT` for a PIN on an account without email. Unexpected
  errors are 500s instead of a misleading 400.
- **Behaviour change:** an invitation link accepted by a signed-in account whose
  email is not the invited one is refused (`INVITATION_EMAIL_MISMATCH`, with
  `details.email` a masked hint such as `a***@acme.example`), and the link stays
  usable by the invitee. Accounts with no email (phone sign-up) still accept with
  the link. Configure with `invitationAccountMatch`: `'email-when-present'`
  (default), `'email'` (also refuse accounts without email) or `'any'` (previous
  behaviour).
- `@fonderie/client` translates the new reasons in en, fr, es, zh-Hans and zh-Hant.
