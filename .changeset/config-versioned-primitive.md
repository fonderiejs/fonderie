---
"@fonderie/config": patch
---

Config control-plane, phase 6 (generalize) — lift the version index / optimistic
concurrency / advisory-locked write / append-only revisions / rollback /
push-notify machinery into a shared `versionedWrite` + `versionedRollback`
primitive (`services/versioned.ts`) that both `config` and `secrets` now run on.
Removes the ~1:1 duplication between the two services and makes a new versioned
admin resource a table descriptor + its read shape away. Pure internal refactor
— no public API or behavior change (`ConfigConflictError` is re-exported from the
same path); all 29 tests green + re-proven end-to-end against real Postgres for
both resources (OCC, revisions, rollback, secret encrypt/mask/reveal, and the
resource-specific `fonderie_config_changed` / `fonderie_secrets_changed`
channels).
