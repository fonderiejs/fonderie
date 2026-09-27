---
'@fonderie/config': minor
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/cli': patch
---

Remote config for frontends: switch a feature on in the admin, and screens
follow without a deploy.

- **config:** `publicKeys` option — the keys a frontend may read, as a list or
  a record of key → default. Served by a new unauthenticated
  `GET /config/public` from the in-memory snapshot, `Cache-Control: no-store`.
  Nothing is exposed unless listed; secrets are never readable there.
- **client:** `client.config` — `load()` fills one shared snapshot per
  FonderieClient (concurrent calls share a request; a failed refresh keeps the
  previous values), `get(key, fallback)`, `snapshot()`, `subscribe()`.
- **react** (works in React Native too) and **vue:** `useRemoteConfig()` and
  `useFlag(key, fallback)` — loaded on first use, shared across components,
  optional `refreshMs`. Pass the SAFE fallback: it renders before the first
  load and when loading fails.
