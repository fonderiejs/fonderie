---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/react-auth': minor
'@fonderie/vue-auth': minor
'@fonderie/react-native-auth': minor
---

Let users disconnect an OAuth provider, and make an OAuth sign-up behave like
a sign-up.

`DELETE /auth/oauth/:provider` removes the linked provider from the caller's
account, with `client.auth.unlinkOauth()` and a `useUnlinkOauth` hook in all
three frontends. It refuses with 409 `PASSWORD_REQUIRED` when the account has
no password: an account created BY the provider has no other credential, so
unlinking would be account deletion rather than a settings change. The guard
is inside the UPDATE's WHERE clause, so a password cannot disappear between
the check and the write. The user DTO now carries `provider` and
`hasPassword` so a settings screen can render the control — and know whether
it is allowed — without probing for the error.

The larger fix is on the way in. `upsertByProvider` returned only an id, which
made a first-ever OAuth sign-in indistinguishable from a returning one, so the
OAuth controller emitted nothing at all. Anything subscribed to
`fonderie.user.registered` therefore never ran for OAuth users — including
`@fonderie/workspaces`, which provisions the personal workspace on that event.
Users who signed up with Google or Apple silently had none. The upsert now
reports whether it inserted and what the previous provider was, and the
controller acts on the difference: a new account emits `user.registered` plus
an `oauth-registration` welcome; an existing account that gains or switches
providers gets an `oauth-linked` security notice; a returning sign-in with the
same provider emits nothing, so users are not emailed on every login. Apple
and Google share the path, so both are fixed.
