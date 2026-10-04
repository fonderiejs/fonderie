<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-auth-screens — signatures

## @fonderie/vue-auth-screens

```ts
component ForgotPasswordScreen(props: { client, locale }) — emits: navigate-login

component LoginScreen(props: { client, locale }) — emits: login-success, mfa-required, navigate-register, navigate-forgot-password

component MfaChallengeScreen(props: { client, locale, mfaToken }) — emits: login-success, navigate-login

component RegisterScreen(props: { client, locale }) — emits: register-success, navigate-login

component ResetPasswordScreen(props: { client, locale, initialPin }) — emits: reset-success, navigate-login

component VerifyEmailScreen(props: { client, locale }) — emits: verified
```
