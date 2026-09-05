---
'@fonderie/auth': patch
'@fonderie/client': minor
---

Auth mediums from the DTO audit: honest SAR exports, typed preferences, the verify-routing signal

The Subject Access Request export (`exportMe`) reported `isPhoneVerified:
false` for every user — it called `toUserDTO` without the session's
phone-verified claim while `GET /users` passes it; the compliance bundle now
agrees with the profile endpoint. The MFA login completion propagates the
claim into both the fresh token pair and its user DTO instead of silently
dropping it. (The OAuth callback deliberately stays `false`: `phoneVerified`
is a session claim, and a fresh browser-redirect session has verified
nothing.)

`updatePreferencesSchema` typed four fields as `unknown`, so `dateFormat:
null` or `notifications: "yes"` validated, got stored, and was then served
against string-typed client fields. The schema now validates all four
(bounded strings; notifications as the four-boolean object), and `toUserDTO`
additionally sanitizes reads — well-typed values survive, garbage falls back
to defaults, and a partial stored notifications object deep-merges over the
defaults so the promised shape can't shrink. Rows poisoned before this fix
are therefore served clean too. `IUpdatePreferencesInput` is typed to match.

`IRegisterResult` and `ILoginResult` gain `requiresVerification?: boolean` —
the server has always sent it on email register/login (it's the signal for
routing to the verify-email screen), but the client types omitted it, so
typed frontends couldn't read it.
