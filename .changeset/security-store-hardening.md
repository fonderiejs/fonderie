---
"@fonderie/store": minor
---

Migration-runner cross-process lock + full TLS gate. (1) The migration runner had no cross-process serialization: several instances booting at once all saw the same pending list and raced to apply the same file. Each migration transaction now takes `pg_advisory_xact_lock` on the migrations table and re-checks the applied set inside the lock, so the losers no-op instead of double-applying. (2) The production TLS gate only inspected the connection-string form (`sslmode=disable`); the config-object form now gets the same rule — `ssl: false` in production throws at boot. Unset `ssl` remains allowed (unix sockets, PG* env vars, string-borne TLS).
