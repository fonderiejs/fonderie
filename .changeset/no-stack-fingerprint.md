---
'@fonderie/adapter-express': patch
---

Two fixes to `mount()`, both about what happens when nobody calls `listen()`.

**Fonderie routes now work on serverless.** `mount()` registered fonderie's catch-all only from `listen()`, so on a platform that default-exports the app (Vercel and friends) it was never registered: the app's own routes answered while every fonderie route — auth, billing, media — returned a 404, which reads like a routing misconfiguration rather than an adapter bug. The catch-all still goes on last, but it is now sealed at whichever comes first, `listen()` or the first request, so a route added after `mount()` keeps its precedence either way.

**The Express fingerprint is gone.** Express sends `X-Powered-By: Express` on every response by default, which is what mass scanners index to build target lists for the next framework CVE. `mount()` disables it. This does not make an app less vulnerable — an attacker who fires the exploit anyway still lands — but it keeps it out of stack-wide dragnets, and no app author should have to remember it. Koa and Hono add no such header; all three adapters now assert that no response header names the framework or fonderie.
