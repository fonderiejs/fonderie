---
"@fonderie/events": patch
"@fonderie/customers": patch
---

Republish `@fonderie/events` and `@fonderie/customers` to fix broken `2.0.0` tarballs. Those two were published from an earlier partial release built when `core`/`store` were assumed to be `1.0.0`, so their tarballs shipped **wrong peer ranges** (`@fonderie/core@^1.0.0`, `@fonderie/store@^1.0.0` — but those are `0.2.0`/`0.1.2`, so `npm install` failed with `ERESOLVE`), and `events@2.0.0` also **shipped without its migration SQL** (`dist/migrations/sql` absent → wouldn't boot). The current source is correct (`core@^0.2.0`, `store@^0.1.1`) and a fresh build includes the SQL; this `2.0.1` republish carries the corrected metadata and complete tarballs. No code change.
