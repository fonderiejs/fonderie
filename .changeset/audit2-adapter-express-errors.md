---
"@fonderie/adapter-express": patch
---

Route middleware errors to `next(err)` instead of rejecting. `adapt()` and the lazy guard wrappers (`withWorkspace`, `requirePermission`, `requireFeature`) had no error handling, so a throw inside a guard (e.g. a store outage) became an unhandled rejection under Express 4 — a possible process crash instead of a 500.
