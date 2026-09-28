---
'@fonderie/cli': patch
---

`fonderie env generate` no longer warns "ships no env.json … upgrade it" about `@fonderie/cli` itself or about frontend packages (`client`, `react-*`, `vue-*`) installed in the same project. They are not bricks and have no deploy-time variables. The brick rule is now one exported `isBrick()`, shared with the `check:env-declarations` gate.
