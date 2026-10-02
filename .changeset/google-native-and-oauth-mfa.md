---
'@fonderie/auth': minor
'@fonderie/client': major
'@fonderie/react-native-auth': minor
---

**Sign in with Google from a native app, and social sign-in now asks for the second factor.**

**`@fonderie/auth`:**
- **`POST /auth/google/native`:** the app posts the ID token the Google SDK gave it. The server checks the token the same way it checks Apple's: signature against Google's published keys (shared hardened key cache), issuer, audience against `google.nativeClientIds`, expiry, a verified email, and single use.
- **Native-only setups:** `google.clientSecret` and `google.redirectUri` are now optional, so a setup can use native sign-in only. The web flow returns 501 without them.
- **New env var:** `GOOGLE_NATIVE_CLIENT_IDS`.
- **Security fix, social sign-in skipped two-factor:**
  - A linked Google or Apple account received a full session even when it had a second factor.
  - Every OAuth sign-in (Google web and native, Apple web and native) now answers `MFA_REQUIRED` with an `mfaToken` when the account has MFA, exactly like a password sign-in.
  - `/auth/mfa/verify` accepts that pending token from any sign-in method. Enabling, disabling and backup codes still require an email sign-in.
  - Suspended accounts are refused on social sign-in too.
- **Docs fix:** the documented Google callback path is now `/auth/google/callback`, not `/auth/oauth/google/callback`.

**`@fonderie/client` (major):**
- New: `auth.googleNative({ idToken, nonce? })`.
- **Breaking:** `auth.appleNative` now returns `ILoginResult | IMfaRequiredResult`, because the server can ask for the second factor. Check `isMfaRequired(result)` before reading `result.tokens`.

**`@fonderie/react-native-auth`:**
- New: `useGoogleSignIn`.
- `useAppleSignIn` and `useGoogleSignIn` return `{ mfaToken }` without storing a session when the account has MFA. Finish with `useMfaLogin`.
