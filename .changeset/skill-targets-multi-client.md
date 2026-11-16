---
"@fonderie/cli": minor
"create-fonderie-app": patch
---

`fonderie skill` and `fonderie init` gain `--target claude|kimi|agents|all` (comma lists allowed) so the lazy skill lands in the directory any coding agent scans — `.claude/skills` (default, unchanged), `.kimi-code/skills` for Kimi Code, or the portable `.agents/skills`. `--out <dir>` still overrides for any other client. The skill bytes are identical for every target; only the directory changes. `init` carries the target into the `postinstall` hook so regeneration stays in the same dirs. create-fonderie-app's output and README no longer assume Claude Code specifically.
