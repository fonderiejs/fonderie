---
'@fonderie/react-native-auth': minor
---

Add `useAuthProviders()` — react-auth shipped it, this package did not.

`react-native-auth` exports its hooks from an explicit list rather than re-exporting react-auth wholesale (its hooks persist tokens to AsyncStorage), so a new react-auth hook does not appear here automatically. The 0.9.0 release bumped this package's version through a dependency change while the hook itself was absent — the version looked current and the API was missing.

On native this is the hook that decides whether to render Sign in with Apple at all. Apple's Guideline 4.8 makes that button's presence conditional on the other social options being offered, so guessing is an App Review risk as well as a broken button — and the server is the only side that knows which providers actually have credentials.

Identical to the react-auth hook, since it carries no token storage.

Also adds `resolveSocialButtons(providers, { isIOS })`, which encodes the rule once instead of in every app: Apple needs the platform AND the server, Google needs only the server, and an iOS build offering Google with no Apple is flagged as an App Store Guideline 4.8 risk.

"Always show Apple on iOS" is the tempting shortcut and it is wrong — `POST /auth/apple/native` answers 501 when the API has no apple config, so the user opens the Apple sheet, authenticates with Face ID, and only then fails. A button that fails after the user commits is worse than one that never appeared, and the always-on version also hides the 4.8 misconfiguration until App Review finds it.

On iOS the guideline is **enforced**, not merely reported: when Apple is unavailable, Google is suppressed too. "If we offer Google we must offer Apple" has a contrapositive — offering neither is compliant, offering Google alone is not — so the shipped binary is correct by construction rather than correct-if-someone-reads-a-warning. `appleGuidelineRisk` still reports the cause, because suppressing a button fixes the build and not the configuration. `enforceAppleGuideline: false` opts out for internal builds.

Android is unaffected: the guideline is Apple's, so there the server decides alone.

Pure and platform-argument-based, so the package still needs no `react-native` dependency.
