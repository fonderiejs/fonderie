---
"@fonderie/workspaces": minor
---

Add `importRole` — completes the workspaces migration trio (`importWorkspace` →
`importRole` → `importMembership`). Imports a custom, workspace-scoped role
preserving its id so migrated memberships resolve to it; `is_system` stays false
(system roles are seeded, resolve those by name). Supplied fields preserved,
omitted ones take table defaults.
