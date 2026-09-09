---
"@fonderie/permissions": patch
---

Harden role checks. The super-role bypass (`hasRole`) now matches only an **active, system** role (`is_system = true AND active = true`), so a member can no longer create a workspace-local role named after the configured super-role (e.g. `ADMIN`) and self-assign it to gain full access. `checkPermission` now also requires the granting role to be `active`. `requireRole` no longer keys off a single arbitrary membership row (`LIMIT 1`) — it evaluates the requirement across all of the user's roles, so a member holding several roles is not denied because the wrong row was inspected.
