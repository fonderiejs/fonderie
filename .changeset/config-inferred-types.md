---
'@fonderie/config': minor
'@fonderie/client': minor
'@fonderie/react-config-admin-screens': minor
'@fonderie/vue-config-admin-screens': minor
'@fonderie/admin': patch
'@fonderie/cli': patch
---

Config values without a type picker — and without silent type changes.

- **Admin (React + Vue):** creating an entry no longer asks for a type. One
  field takes text, a number, true/false, or JSON for an object or a list of
  objects; the detected shape is shown as you type, and only genuinely
  ambiguous input ("true", "42") offers "Save as text instead". Anything that
  merely looks like a number — `1.10`, `0123`, `1e3`, a long ID — stays text
  rather than being rewritten. Editing locks the type to what is stored; a
  deliberate "Change type…" is the only way to change it. The environment line
  is now labelled.
- **config:** every value is stored JSON-encoded, text included. Text used to
  be stored raw and parsed back with a raw fallback, so a text value that
  looked like JSON came back as a different type ("42" → number). Rows written
  the old way still read correctly.
- **config:** saving a different value kind over an existing key (on/off →
  text, list → object) is refused with `409 CONFIG_TYPE_CHANGE` unless the
  request sends `allowTypeChange: true`. Frontends read flags with a typed
  fallback, so a silent change would read as a different setting — this holds
  for the API, the CLI and the UI alike. `configValueKind()` and
  `ConfigTypeChangeError` are exported.
- **client:** `inferConfigValue()` and `configValueLabel()`;
  `ISetConfigInput.allowTypeChange`.
- **cli:** `config set` uses the same inference (it used plain `JSON.parse`,
  which turned "1.10" into 1.1); `--text` and `--allow-type-change` flags.
