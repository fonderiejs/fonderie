---
'@fonderie/sse': patch
---

A stream request that carries credentials the app's auth chain can't verify now gets a **401**, not a silent anonymous stream.

**The bug:** found in production. A phone's saved token had been signed with a since-rotated secret. The auth chain couldn't verify it, so `ctx.user` stayed empty, and `GET /sse/stream` answered **200 as an anonymous stream**. The stream got only public events, and the client had no signal to refresh. An access token expiring between the stream's lifetime reconnects would end up the same way.

**The fix:** a `Bearer` credential with no resolved user is refused with `401 UNAUTHORIZED`. The client already refreshes once on a 401 and reconnects as the user, or the app signs out. A request with no credentials at all is still a legitimate anonymous stream.
