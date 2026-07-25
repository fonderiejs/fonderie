---
"@fonderie/config": minor
---

Config control-plane, phase 2 — push propagation. A config write now emits
`pg_notify('fonderie_config_changed', env)` on commit, and `RemoteConfigManager`
gains an optional `connectionUrl`: when set, it opens a dedicated `LISTEN` client
and refreshes its snapshot within **milliseconds** of any write (replacing the
30s poll latency; the `ttl` poll becomes a slow safety floor). Unset =
poll-only, unchanged. `pg` is a peer dependency (matching `@fonderie/events`).
Proven end-to-end against real Postgres: a write on one connection propagates to
a separate manager's snapshot in ~400ms while a poll-only control stays stale.
