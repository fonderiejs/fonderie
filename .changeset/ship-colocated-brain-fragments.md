---
"@fonderie/adapter-express": patch
"@fonderie/adapter-hono": patch
"@fonderie/adapter-koa": patch
"@fonderie/audit": patch
"@fonderie/auth": patch
"@fonderie/billing": patch
"@fonderie/client": patch
"@fonderie/config": patch
"@fonderie/core": patch
"@fonderie/courier": patch
"@fonderie/customers": patch
"@fonderie/events": patch
"@fonderie/logger": patch
"@fonderie/permissions": patch
"@fonderie/store": patch
"@fonderie/webhooks": patch
"@fonderie/workspaces": patch
---

Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.
