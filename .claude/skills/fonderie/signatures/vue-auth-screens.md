<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-auth-screens — signatures

## @fonderie/vue-auth-screens

```ts
component ForgotPasswordScreen(props: { client }) — emits: navigate-login

component LoginScreen(props: { client }) — emits: login-success, mfa-required, navigate-register, navigate-forgot-password

component MfaChallengeScreen(props: { client, mfaToken }) — emits: login-success, navigate-login

component RegisterScreen(props: { client }) — emits: register-success, navigate-login

component ResetPasswordScreen(props: { client, initialPin }) — emits: reset-success, navigate-login

component VerifyEmailScreen(props: { client }) — emits: verified
```
