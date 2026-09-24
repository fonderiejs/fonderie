---
'@fonderie/cli': patch
---

brain.json stops silently under-reporting the packages it maps

`packages/cli/data/knowledge.json` is regenerated, so the CLI's shipped brain
now carries the 7 routes, 3 core probes, 1 subpath and 105 dependency edges it
was quietly missing. No API change.
