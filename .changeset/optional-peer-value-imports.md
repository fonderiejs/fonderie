---
"@fonderie/auth": patch
"@fonderie/billing": patch
"@fonderie/courier": patch
"@fonderie/workspaces": patch
---

Make the optional `@fonderie/events` peer actually optional. These packages declared it optional (every emit is a conditional `bus?.emit`) but value-imported the `NOTIFICATION_EVENT` constant, which hard-required the package at module load — install auth without events and the bundle crashed with ERR_MODULE_NOT_FOUND (found dogfooding: npm pruned the optional peer and the app broke). The event-name contract is now declared locally per package, typed via a type-only import. The built bundle contains zero references to `@fonderie/events` and loads with the package absent.
