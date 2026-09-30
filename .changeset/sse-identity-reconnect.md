---
'@fonderie/client': minor
---

The live stream now reopens when the identity it was opened as changes: sign-in, sign-out, a different user, or a different workspace.

**The bug:** the server decides what a stream may receive when the stream opens. A stream opened at app start, before sign-in, stayed **anonymous** for its whole life. Config still arrived, but every workspace or user event was withheld from it. Found in production, where a signed-in phone's stream was logged as `user=anonymous`.

**The fix:** `TokenStore` now announces changes (`onChange`), and `SseClient` compares the identity it's connected with (the token's user, from its `sub` claim, plus the workspace) and reconnects only when that changes. A silent token refresh for the same user doesn't reconnect. `FonderieClient.setWorkspaceId` also triggers the check. New public method: `client.sse.identityChanged()`.
