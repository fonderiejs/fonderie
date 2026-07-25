---
"@fonderie/courier": patch
---

Security: bump `nodemailer` `^8.0.7` → `^9.0.3` to clear a high-severity
advisory (CRLF/List-* header injection, jsonTransport file-access bypass, and
improper TLS validation in OAuth2 token fetch — GHSA-268h-hp4c-crq3 and
related). Courier uses only the stable `createTransport`/`sendMail` surface,
so the major bump is transparent to consumers.
