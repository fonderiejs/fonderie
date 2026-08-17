# Cryptography Policy

> **Status:** DRAFT stub — not adopted. Fill every `[FILL: …]` and have an
> officer approve before it counts as a control.
> Owner: `[FILL: role]` · Version: 0.1 · Effective: `[FILL: date]` ·
> Review: annually or on material change.

## Policy
- **In transit.** TLS `[FILL: 1.2+]` for all external traffic; HSTS enabled in
  production (`withSecurityHeaders`).
- **At rest.** Database and backups encrypted with `[FILL: KMS/provider]`.
  Application-level: passwords hashed (bcrypt), MFA/TOTP secrets encrypted
  (AES-256-GCM), config secrets via an encryptor.
- **Key management.** Keys stored in `[FILL: KMS]`, access restricted, rotated
  `[FILL: cadence]`. Key loss/rotation procedures in the DR plan.
- **Integrity.** The audit/event log carries a keyed per-event HMAC; integrity
  is verified on a `[FILL: cadence]` schedule.
- No custom cryptography — vetted libraries only.
