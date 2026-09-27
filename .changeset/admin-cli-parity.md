---
'@fonderie/store': patch
'@fonderie/courier': minor
'@fonderie/client': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/react-courier-admin-screens': minor
'@fonderie/vue-courier-admin-screens': minor
'@fonderie/react-admin-screens': minor
'@fonderie/vue-admin-screens': minor
'@fonderie/admin': patch
---

The admin console now does what the CLI does for config, secrets and templates — and no longer edits the wrong row.

**Fixed — the console could act on a different row than the one clicked:**
- Opening a config entry or secret dropped its environment: a production-only row opened (and saved over) the shared `all` value.
- Revealing a secret revealed the list's scope, not the row's environment.
- Opening a template dropped its locale: the French row opened, and saved, the default copy.
- `@fonderie/store`: re-creating a key that had been deleted failed with a 500 — the new version 1 collided with the key's surviving revision history. It now continues after the last revision; history is kept.

**New, matching the CLI:**
- Delete for config, secrets and templates (behind the fresh-code prompt).
- **Built-in emails cannot be deleted.** `@fonderie/courier` refuses to delete the default-locale row of a seeded or module-shipped template (409 `SYSTEM_TEMPLATE`) and marks those rows `system: true` in the list — they can be edited and rolled back only. Locale variants and app-added templates remain deletable. A test pins the seeded list to migration 002.
- Environments: filter Config & secrets by environment; create an entry in a chosen environment.
- Templates: "New template", and "Add locale" on a template (starts from the default copy).
- Version checks on the config and template editors: a concurrent change shows a conflict with Reload instead of being overwritten.
- Public config: keys served to frontends are marked "public", with a preview of exactly what `GET /config/public` returns.
- Audit: from/to date filters. Billing: read a subscriber's wallet in another currency.
