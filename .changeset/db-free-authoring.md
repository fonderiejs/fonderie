---
"@fonderie/cli": patch
---

Skill router now states the definition of done — a Fonderie app is done when it typechecks and is wired per recipe; **no database is needed to build** (bricks own their migrations, which run on boot, and their routes are guaranteed by the package). Stops agents from provisioning a Postgres or booting to "check it works" during authoring. Confirmed: a typecheck-clean wired app boots, self-migrates, and serves the brick routes with no hand-written glue (experiments/phase41-2026-07/DECISION-DB-FREE-AUTHORING.md).
