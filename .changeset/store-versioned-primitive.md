---
"@fonderie/store": minor
"@fonderie/config": patch
---

Lift the versioned-resource control-plane primitive into `@fonderie/store` so any
package can reuse it (no `config` dependency). `versionedWrite` /
`versionedRollback` / `VersionConflictError` are now exported from store,
generalized: a resource declares its `(primary, scope)` key columns (null-safe —
a NULL scope is the base), its revisioned `contentColumns` (one or many), and
optional main-table `metaColumns`. This serves config's `(key, environment,
value)` and courier's `(type, locale, subject/html/text)` shapes alike.
`@fonderie/config` re-points onto it; `ConfigConflictError` is now an alias of
`VersionConflictError` (same exported name, `instanceof` unchanged). Behavior
preserved — config 36/36 + store tests green, and both shapes proven end-to-end
against real Postgres (incl. NULL scope + multi-column rollback).
