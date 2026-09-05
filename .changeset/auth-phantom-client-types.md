---
'@fonderie/client': minor
'@fonderie/react-auth': patch
'@fonderie/vue-auth': patch
'@fonderie/react-native-auth': patch
---

Fix two phantom auth client types — and the runtime crash they were hiding

`IResendVerificationResult` claimed `{ stat, message, data: { token,
expiresAt, email } }` — a shape no server path produces (and whose phantom
`data.token` falsely implied the verification pin is sent to the client; it
is only ever emailed). It is now `{ email?, verified? }`, matching the
server's two success branches. `IMfaEnabledResult` claimed `{ tokens, user }`,
but the MFA setup-confirmation endpoint returns `{ mfaEnabled: true }` — the
`{ tokens, user }` shape only exists on the mfa-pending login path, which
`verifyLogin` already types correctly as `ILoginResult`.

The second phantom was hiding a live bug: `useMfaSetup().verify` in
react-auth, vue-auth, and react-native-auth all read `result.tokens.access`
after enabling MFA, so every successful enrollment through those hooks threw
a TypeError at runtime (their own tests asserted the phantom shape against a
mocked phantom response). The hooks no longer touch the session token —
correctly, since the server never rotates it on setup confirmation (MFA is
enforced at login; the current session remains valid unchanged) — and their
tests now pin the real contract.
