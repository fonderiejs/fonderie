---
"@fonderie/cli": patch
---

Fix the kimi/agents skill targets being silently invisible. Their scanners reserve the filename `SKILL.md` for the directory form (`<name>/SKILL.md`), so the top-level `SKILL.md` the CLI wrote was never registered — the agent hand-rolled auth while the skill sat on disk (found by dogfooding a headless Kimi Code build). Flat targets now write `fonderie.md` next to the unchanged `fonderie/` bodies; the claude target and `--out` are unchanged. Tests pin the layout per target.
