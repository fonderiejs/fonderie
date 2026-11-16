---
"@fonderie/cli": minor
---

`fonderie init` now also leaves a marker-guarded pointer in AGENTS.md — the one channel every coding agent reads, with or without a skill scanner (Cursor, Aider, …) — directing it at `fonderie query --concepts`. Existing AGENTS.md files are appended to, never replaced; repeat inits stay idempotent.
