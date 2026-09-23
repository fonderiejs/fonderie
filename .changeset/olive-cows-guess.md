---
'@fonderie/cli': patch
---

`fonderie migrate --check` fails when it cannot reach the database

An unreachable database passed. Everything downstream swallows errors by
design — `pending()` catches its own read failure and returns every file — so a
refused connection produced `61 pending — first-time setup, nothing to lose`
and **exit 0**. A gate green precisely because it reached nothing, which is
worse than no gate.

It now probes with `SELECT 1` before anything else and exits 1 on failure,
naming the target and the driver's error, with the shapes that commonly parse
elsewhere but not here: a keyword string (`host=… dbname=…`), surrounding
quotes, a stray newline.

A *reachable* database with no `fonderie_migrations` table is unchanged — still
a legitimate first install, still passes, still says so.

Found in CI: the migration gate reported success against a value that was not a
parseable URL at all.
