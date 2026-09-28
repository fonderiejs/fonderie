---
'@fonderie/risk': minor
---

The risk pepper is held to core's shared secret rule (`secretStrengthProblem`: at least 32 characters, no placeholder words) instead of a private three-word denylist. In production, a pepper that passed before but contains a placeholder word such as `change-me`, `example` or `placeholder` now refuses to construct `RiskEngine` — generate one with `openssl rand -hex 32`.
