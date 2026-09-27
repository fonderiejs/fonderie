---
'@fonderie/client': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/react-admin-screens': patch
'@fonderie/vue-admin-screens': patch
'@fonderie/admin': patch
---

Admin editors that respect the operator's time.

- **Templates:** the preview sits to the right of the editor and stays pinned
  while the form scrolls (it used to wrap below the fold), and it is always
  live — re-rendered 500 ms after the last edit instead of on a Render click.
  Save is disabled with "No changes to save" until the content differs from
  what is stored.
- **Config & secrets:** the page had no way to create an entry and rendered
  bare headings when empty. It now has an empty state and **New entry** /
  **New secret** buttons; creating refuses an existing key rather than
  overwriting it. Values are edited by type — Text, Number, On/off or JSON —
  instead of raw JSON, and a value that does not parse shows why (it used to
  fail silently). The list shows each entry's type and value.
- **client:** `castConfigValue`, `configValueType`, `formatConfigValue`,
  `configKeyProblem` and `CONFIG_VALUE_TYPES` — the typed-value rules the
  editors use, shared so feature-flag hooks can use the same casting.
