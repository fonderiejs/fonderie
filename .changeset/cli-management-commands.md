---
"@fonderie/cli": minor
---

Config control-plane, phase 5 — management CLI (the LLM-native interface). Adds
`fonderie config <get|set|delete|history|rollback>` and `fonderie secret
<get|set|delete|history|rollback|reveal>` — a thin, zero-dep client over the
admin API (`FONDERIE_ADMIN_URL` + `FONDERIE_ADMIN_TOKEN`; optional
`FONDERIE_ACTOR`). The five kubectl-inspired verbs are held in a single `VERBS`
dictionary (method + path suffix + requirements), so usage/help derive from one
source and adding a resource costs the LLM ~zero extra grammar. `set` honours
`--if-version` (optimistic concurrency) and exits **2** on a 409 conflict
(reload-and-retry); config values are JSON-parsed, secret values stay raw
strings; secret reads are masked, `reveal` is the explicit decrypt path.
