---
'@fonderie/store': minor
'@fonderie/cli': minor
---

`fonderie migrate --check` — a CI gate that refuses to delete data unattended

Migrations had no way to say what they would *do*. A pipeline applying them
unattended is fine for `CREATE TABLE` and not fine for `DROP TABLE`: the data is
gone, and no down-migration brings it back — an empty table recreated by a
rollback is not a rollback.

`classifyMigration(sql)` in `@fonderie/store` labels a migration `additive` or
`destructive` and returns the statements that earned the label, so a caller can
show *what* will be lost rather than a generic warning. Conservative by design:
`DROP TABLE|COLUMN|SCHEMA`, `TRUNCATE` and `ALTER COLUMN … TYPE` all count,
because a false "destructive" costs one approval and a false "additive" costs
the data.

`fonderie migrate` uses it:

```bash
fonderie migrate --status     # what is pending, per package, with impact
fonderie migrate --check      # exit 1 if a pending migration deletes data
fonderie migrate --dry-run    # classify every migration found — no database
```

The CI shape it exists for — the gate, then the app's own runner:

```bash
fonderie migrate --check && npm run migrate
```

**It reports; it does not apply.** The order migrations run in is the app's to
declare — app tables reference brick tables — and a CLI guessing that order
would eventually guess wrong in a way that only appears on a fresh database.

**A database with nothing applied is never flagged.** Brick history legitimately
drops columns earlier migrations in the same set created, so flagging those
would refuse every first-time install.

Zero CLI dependencies preserved: `@fonderie/store` is imported from the
consuming app's own `node_modules`. Note these packages are ESM-only — their
exports maps have `import` but no `require` — so resolution reads the exports
map rather than using `createRequire`, which answers
`ERR_PACKAGE_PATH_NOT_EXPORTED` for every one of them.
