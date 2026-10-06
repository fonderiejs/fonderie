---
'@fonderie/auth': patch
---

A phone sign-in code now works once, survives five wrong guesses, and can't be used to flood a phone with texts.

The phone code is the whole credential of a phone sign-in, and it had three gaps:

- **Used twice.** Checking the code and deleting it were two statements, so two requests racing with one code both got a session. The code is now consumed in one statement.
- **Guessed without limit.** Only a per-IP limit applied, so guesses from many addresses went unbounded. Five wrong tries now spend the code, as with account-deletion and step-up codes.
- **Texts on demand.** Each `POST /auth/login { phone }` sent a new text, so anyone who knew a number could flood it. Within the verification cooldown, no new text goes out, the code already sent stays valid, and the answer is the same. The resend route's cooldown is now claimed in one statement too.

A suspended account is now refused before any session row is written; before, one was stored and then refused. Apply auth migration `026_phone_otp_attempts` (additive).
