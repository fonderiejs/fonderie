---
"@fonderie/cli": patch
---

Close the catalog blind spots: 16 new concepts and 13 recipes cover every shipped capability brick — `storage.files`, `media.uploads`, `risk.abuse`, `sse.realtime`, `admin.ops`, `logger.logging`, the three `adapters.*` mounts, and the media/admin frontend hooks and screens (`react-media`, `vue-media`, `react-native-media`, `react-admin(+screens)`, `vue-admin(+screens)`). `fonderie query` and the skill router can now surface them; previously an agent had no way to discover these packages existed. Router stays lazy: ~7350 tok, under the 8000 budget.
