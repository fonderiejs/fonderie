---
"@fonderie/store": patch
"@fonderie/cli": patch
---

Refuse migration filename collisions. `fonderie_migrations` records applied migrations by filename alone, so two modules shipping the same filename meant the second was silently skipped forever. `@fonderie/store` adds `assertUniqueMigrationNames(sets)` and `runMigrationSets(store, sets)`, which applies several directories in order after refusing — naming the file and both directories — before touching the database. `fonderie migrate` (`--status`, `--check`, `--dry-run`) now exits 1 on a collision across the installed bricks and `--app`. The table key is unchanged.
