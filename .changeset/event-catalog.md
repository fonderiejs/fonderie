---
'@fonderie/core': minor
'@fonderie/events': patch
'@fonderie/config': minor
'@fonderie/customers': minor
---

The event catalog, step 2 of `docs/REALTIME-DESIGN.md`: each brick declares which of its events a client may receive.

**`@fonderie/core`:**
- New optional module method `describeEvents()`, beside `describeAdmin()`, returning `IEventCatalogEntry[]`. Each entry has a type, a description, and an audience: `'public'`, `'workspace'`, `'user'`, or a function for the app's own rule. It can also give a `scope(payload)`, which is required for the workspace and user audiences, and a `project(payload)` listing the client-safe fields (ids only). It can name a Postgres NOTIFY `source`.
- `app.eventCatalog()` merges and validates every module's entries. It throws on an invalid entry, or on one type declared by two modules. The default is deny: an event with no entry is never delivered to a client.
- `matchesTopic` / `isValidTopicFilter` for client topic filters: `*`, an exact type, or a `prefix.*` segment prefix. They are matched literally, never as a regex.

**`@fonderie/events` (R4):** `matchesPattern` escaped only `.`, so any other regex metacharacter in a pattern was live regex, and `a+b` matched `aab`. Every character except `*` is now literal. The wildcard semantics are unchanged.

**`@fonderie/config`:**
- Declares `fonderie.config.changed`, public and sourced from its existing NOTIFY. It carries the environment only, never keys or values.
- **R3:** deleting a config entry now sends the same NOTIFY as a write, inside the transaction and only when a row was deleted. Before, other instances learned of a delete only on their next poll.

**`@fonderie/customers`:** declares its five events for the workspace audience. They carry only `customerId` and `workspaceId`, never personal data.
