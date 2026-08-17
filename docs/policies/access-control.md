# Access Control Policy

> **Status:** DRAFT for review — not yet adopted. Confirm the values in
> **\[brackets]**, then have an officer approve and date it before it counts as a
> control. Where a statement cites code, the control already exists in the repo.
>
> Owner: **Louis Choleski (founder, acting Security Officer)** · Approver: **Louis Choleski (founder)** ·
> Version: 0.1 (draft) · Effective: **[date on adoption]** · Review: at least
> annually and on material change.

## 1. Purpose & scope
Govern who can access Fonderie and customer systems and data, and how that
access is granted, reviewed, and removed. Covers production infrastructure,
source repositories, cloud/corporate accounts, and the application itself.

## 2. Policy
### Identity & authentication
- Every user has a **unique** account; shared or generic logins are prohibited.
- **Single sign-on (SSO)** is used wherever a system supports it.
- **Multi-factor authentication (MFA) is required** for all production, admin,
  cloud, source-control, and email access. The product itself supports and can
  require MFA via `@fonderie/auth` (TOTP + backup codes, secrets encrypted at
  rest).
- Local passwords (where SSO is unavailable) are at least **12 characters**,
  checked against known-breached lists, and stored hashed (bcrypt in-product).

### Authorization
- Access is granted on the principle of **least privilege**, by role, and only
  after approval by the resource owner or the Security Officer.
- **Privileged/production access** is limited to named individuals (Louis Choleski (founder)),
  logged, and reviewed monthly.
- Application access is **workspace-scoped** and enforced by RBAC
  (`@fonderie/permissions`) with tenant-isolated, parameterized queries.

### Lifecycle
- **Provisioning** happens on hire or role change via a ticket that records the
  approval.
- **Deprovisioning**: all access is revoked within **24 hours** of departure or
  role change (**same day** for privileged/production access). See Personnel
  Security.
- **Access reviews** are performed **quarterly**; the Security Officer signs off
  and any unneeded access is removed.

### Secrets
- Application and infrastructure secrets live in **[secrets manager — e.g. AWS
  Secrets Manager / 1Password]**, never in source or tickets.
- Signing secrets and DB credentials are validated **fail-closed at boot** (the
  app refuses to start on a weak/placeholder secret or empty prod DB URL).

## 3. Exceptions & enforcement
Per the Information Security Policy. Emergency ("break-glass") access is logged,
time-boxed, and reviewed within 1 business day.
