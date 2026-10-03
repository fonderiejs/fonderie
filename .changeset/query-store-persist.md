---
'@fonderie/client': minor
---

**A cold start opens screens on their last data.** `queries: { persist: { storage } }` (AsyncStorage, localStorage, or any `getItem`/`setItem` pair) keeps the shared read model on the device. After an app restart every screen shows what it showed last, at once, then refreshes it behind what is shown. Restored entries count as unconfirmed, so the first screen that asks refetches them even if they were saved a minute ago. `client.queries.hydrated` resolves once the snapshot is loaded, for an app that wants to hold its splash screen on it; hooks do not need to wait.

Safe by construction, because the snapshot holds whatever the screens showed:
- **Tied to the signed-in user**: the `sub` of the access token, decoded locally, never verified client-side. A snapshot loads only for the user who saved it. A token for a different user (signed in without a sign-out in between) wipes what the previous one saw before anything is shown. A token refresh for the same user keeps it.
- **Wiped when the session ends**: sign-out, revocation and `clearCache()` empty the device copy as well as the screens. Nothing is saved or loaded without a signed-in user.
- **Opt-in, with `filter(queryKey)`** to choose what may sit on the device (keys start with `GET /<path>`). For example, keep billing and workspace data but not customers' personal data.
- **Bounded**: `maxEntries` (default 200, most recently confirmed first) and `maxAgeMs` (default 7 days). An answer fetched while the snapshot loads is never replaced by the saved one. An unreadable or malformed snapshot is ignored.
