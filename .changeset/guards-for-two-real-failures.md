---
'@fonderie/store': minor
'@fonderie/events': minor
---

Two guards for failures that actually happened, each caught where it is cheap
instead of where it is confusing.

**Migrations that would run out of order now refuse to run.** Files are applied
lexicographically, so `"1100_" < "200_"` — a migration numbered past the widest
existing prefix runs FIRST, before the tables it alters exist. It is invisible
on a database that already has the earlier ones applied, so production stays
green while CI, a new contributor's first setup and a restore from backup all
break. Detection is exact rather than a style rule: the lexicographic order is
compared against the numeric one, so a consistently padded scheme, timestamp
prefixes and unnumbered files are never flagged. The error names the file that
actually moved and how to renumber it.

**`consume: true` against a connection that cannot LISTEN now says so.** A
transaction-mode pooler lends a backend per transaction and takes it back, so a
LISTEN registered on one is gone by the next statement — poolers reject it
outright. The raw error only reports an unsupported statement, on a connection
string that works everywhere else in the app, which reads as "the database is
broken". `explainListenFailure` (exported, alongside `explainDrainFailure`)
names the cause and both fixes: point the consumer at the session-mode endpoint
— same database, same credentials, different port — or set `consume: false` and
drain on a schedule, which issues no LISTEN and runs anywhere.
