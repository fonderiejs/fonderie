---
"@fonderie/config": minor
---

Config control-plane, phase 1 — version index, revisions, rollback, optimistic
concurrency. Each write bumps a monotonic `version` and appends an immutable
revision (`fonderie_config_revisions`); `updated_by` records the actor.
`setConfigEntry` takes an optional `ifVersion` (compare-and-swap — commits only
if the version matches, else throws `ConfigConflictError`; reject-and-retry) and
`actor`. New `rollbackConfigEntry` rolls *forward* to a past value (k8s `rollout
undo`), and `listConfigRevisions` returns the history. Concurrency is safe: an
advisory xact lock keyed on `(key, environment)` serializes writers even for a
key that doesn't exist yet (closing the create-race the row lock can't cover).
Existing `setConfigEntry` callers are unaffected (the new fields are optional).
