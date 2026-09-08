---
'@fonderie/courier': patch
---

Support nodemailer 10. Its `SendMailOptions` is now an exact-optional type, so the SMTP channel no longer passes `html: undefined` for text-only templates — it omits the field instead (never meaningful at runtime). Bumps the dependency to `^10.0.0`; nodemailer 10 requires Node ≥ 20, which the package already requires.
