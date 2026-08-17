# Cryptography Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Define how Fonderie protects data with cryptography, in transit and at rest, and
how keys are managed. Applies to all systems handling Fonderie or customer data.

## 2. Policy
### In transit
- **TLS 1.2 or higher** for all external and service-to-service traffic; weak
  ciphers and protocols disabled.
- **HSTS** is enabled in production and secure-by-default headers are set
  (`withSecurityHeaders`); auth cookies are `Secure; HttpOnly; SameSite`.

### At rest
- **At production launch**, the database and all backups will be encrypted at
  rest using a managed KMS (provider not yet selected).
- Application-level protection is **already implemented and shipped**:
  - passwords hashed with **bcrypt** (cost 12);
  - **TOTP/MFA secrets encrypted with AES-256-GCM** under a server-held key;
  - config secrets encrypted through a pluggable encryptor.
- Restricted data (tokens, credentials, PII) is never written to logs or tickets.

### Integrity
- The audit/event log carries a **keyed per-event HMAC**; integrity is verified
  on a scheduled job (`verifyEventChain`) and failures alert on-call.

### Key management
- Keys are generated, stored, and rotated in **a KMS/secrets manager to be provisioned before production launch**; access is
  restricted to the founder (Louis Choleski), expanded as the team grows and logged.
- Rotation cadence: **annually and on suspected compromise**. Key loss and rotation
  procedures are covered by the BC/DR Plan (losing the MFA key forces user
  re-enrollment).
- **No home-grown cryptography** — only vetted, standard libraries and algorithms.

## 3. Exceptions & enforcement
Per the Information Security Policy.
