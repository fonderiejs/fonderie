---
'@fonderie/react-native-auth': minor
---

Add `useAuthProviders()` — react-auth shipped it, this package did not.

`react-native-auth` exports its hooks from an explicit list rather than re-exporting react-auth wholesale (its hooks persist tokens to AsyncStorage), so a new react-auth hook does not appear here automatically. The 0.9.0 release bumped this package's version through a dependency change while the hook itself was absent — the version looked current and the API was missing.

On native this is the hook that decides whether to render Sign in with Apple at all. Apple's Guideline 4.8 makes that button's presence conditional on the other social options being offered, so guessing is an App Review risk as well as a broken button — and the server is the only side that knows which providers actually have credentials.

Identical to the react-auth hook, since it carries no token storage.
