---
'@fonderie/store': patch
---

The migration runner now creates `fonderie_migrations` under the same
advisory lock its appliers take. `CREATE TABLE IF NOT EXISTS` is not
concurrency-safe in Postgres: two processes racing it (instances booting at
once, or parallel suites sharing a database) could fail with a duplicate key
on `pg_type_typname_nsp_index`. Observed in CI; the same race could hit
concurrent production migrations.
