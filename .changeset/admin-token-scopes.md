---
'@fonderie/admin': minor
---

Scoped tokens: issue, expire, revoke — without a redeploy

The admin surface had one credential, the configured `adminToken`, and
handing it to a dashboard meant handing over secret reveal and every
mutation. Now, with a store and the package's new migration
(`fonderie_admin_tokens`), the configured token is the **root** and can
issue scoped tokens: `read` (every GET except under `/secrets`), `write`
(every mutation, implies read), `secrets` (anything under `/secrets`,
implies both). The scope a route needs is derived from the route itself.

Only the hash is stored; the plaintext is shown once. A valid token short of
the scope is 403; unknown, revoked or expired is the same 401 as missing.
The root is the only credential that can issue or revoke — a scoped token
can never mint one. In the admin log the actor becomes `token:<name>`.
`GET /_admin/access/tokens` lists what was issued; `POST` issues, `DELETE
/:id` revokes. Without a store nothing changes: root only, issuing off.
Phase 8e of `docs/ADMIN-BRICK-DESIGN.md`.
