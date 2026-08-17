# Access Control Policy

> **Status:** DRAFT stub — not adopted. Fill every `[FILL: …]` and have an
> officer approve before it counts as a control.
> Owner: `[FILL: role]` · Version: 0.1 · Effective: `[FILL: date]` ·
> Review: annually or on material change.

## Policy
- **Least privilege / need-to-know.** Access granted by role, approved by
  `[FILL: approver]`, and reviewed every `[FILL: e.g. quarter]`.
- **Authentication.** Unique accounts; SSO where available; **MFA required** for
  all production and admin access. (Product enforces MFA via `@fonderie/auth`.)
- **Passwords/secrets.** No shared credentials. Secrets in `[FILL: vault]`, never
  in code. Signing secrets are validated fail-closed at boot.
- **Provisioning/deprovisioning.** Access granted on hire/role change and
  revoked within `[FILL: e.g. 24h]` of departure (see Personnel Security).
- **Privileged access.** Admin/prod access is logged and restricted to
  `[FILL: named roles]`.
- **Tenant isolation.** Application access is workspace-scoped and enforced by
  RBAC (`@fonderie/permissions`).
