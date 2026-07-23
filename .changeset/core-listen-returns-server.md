---
"@fonderie/core": minor
---

`FonderieApp.listen()` now returns the underlying `http.Server` (previously `void`), so you can await `listening`, close it for graceful shutdown, or hand it to a supertest-style harness. Adds a `quiet` option to suppress the startup banner (tests / quiet deploys). Backward compatible — existing `app.listen(port)` calls are unaffected. This also unblocks a regression test proving the built-in server forwards multiple `Set-Cookie` headers (the cookie fix from #55/#56).
