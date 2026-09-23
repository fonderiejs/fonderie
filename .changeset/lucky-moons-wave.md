---
'@fonderie/cli': patch
---

`fonderie migrate` stops demanding a connection mode it does not need

The no-DATABASE_URL error and the help text both insisted on a SESSION or
DIRECT url and warned against the transaction pooler. That is wrong for this
command: `--status` and `--check` only READ which migrations are applied —
`pending()` lists files and selects from the migrations table, taking no
advisory lock and issuing no DDL. Any connection mode works, pooler included.

The session/direct requirement belongs to whatever APPLIES migrations, which
this command deliberately does not do.

A wrong warning is worse than none. This one sent people provisioning a second
database credential to satisfy a constraint that was never there.

The error now points at `--dry-run` instead, which skips the database entirely.
