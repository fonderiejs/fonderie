---
'@fonderie/store': minor
---

`versionedWrite` treats a save identical to the current row as a no-op: no
version bump, no revision, no invalidation broadcast — it returns the current
row. Config entries, secrets and courier templates all write through it, so an
unchanged save no longer fills their history with identical versions (which
also made "roll back one version" a no-op). The comparison runs in SQL under
the row lock (`IS NOT DISTINCT FROM`, so NULLs and types compare exactly), and
a stale `ifVersion` still conflicts first. Verified against Postgres 16.
