---
"@fonderie/workspaces": major
---

Privileged workspace routes now require a manager (BREAKING). Every mutating route — role create/update/delete/set-permissions, member remove and role assign/unassign, invitation create/cancel, settings update, archive/restore, workspace update — previously only verified *membership*; any member could manage roles, evict members, or archive the tenant. These routes now additionally require the caller to be the workspace **owner** or hold an **active system role** (the seeded ADMIN), via the new exported `requireManager` middleware. Reads, invitation acceptance, and workspace creation/listing are unchanged, and personal workspaces pass via ownership. Apps that deliberately run flat teams can restore the old behaviour with `management: 'any-member'` in the module config.
