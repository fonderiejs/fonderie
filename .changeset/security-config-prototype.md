---
"@fonderie/config": patch
---

Flag lookups no longer fail open through the prototype. `get(key, fallback)` resolved plain-object lookups, so keys like `constructor`/`toString` returned inherited Object.prototype members — truthy functions — and a feature gate keyed on attacker-influenced input failed OPEN. Lookups now require an own property, and the entries snapshot is built with a null prototype so a DB row keyed `__proto__` cannot pollute it.
