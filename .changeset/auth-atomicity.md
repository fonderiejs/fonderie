---
'@fonderie/auth': patch
---

Close the auth races that let an email go unproven, a session outlive a password change, or another authenticator take over two-factor (atomicity audit A12, A17, A19, B3, B5).

- **Email verification is bound to the address it was sent to.** Verifying used to mark whatever address the account had at that moment. If a resend raced a change of email, a code read in one inbox verified an address nobody proved. The code is now consumed in one statement and verifies only its own address. Codes issued before this release still work. Changing the email and issuing its code happen in one transaction. A taken address, or one belonging to an account awaiting deletion, now answers 409 instead of 500.
- **A password change ends every session in the same statement.** Before, a failure after saving the password left every old session valid, an attacker's included. A password sign-in racing the change can no longer store a session on the old password.
- **Two-factor setup is refused while two-factor is on.** Setup, then confirm with any authenticator, replaced the working secret and backup codes with no proof of the current one, so a stolen session could take over the second factor. Confirm also only enables the exact secret it checked, so a setup that replaced it in between no longer locks the person out. Setup and disable each write in one transaction.
- **Sign-ups racing for one email or phone get 409, not a 500.** A racing phone sign-up no longer rewrites the existing account's name.

Apply auth migration `027_email_verification_binding` (additive).
