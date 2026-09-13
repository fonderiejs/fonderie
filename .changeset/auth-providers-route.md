---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/react-auth': minor
'@fonderie/vue-auth': minor
---

Add `GET /auth/providers` — which sign-in methods this deployment can actually honour.

A login screen has to decide which buttons to draw, and the only honest source is the side holding the credentials. The alternative is a build-time flag in the frontend, which stores the same fact twice and lets the two disagree: the app offers a provider the server cannot complete, and the user lands on the provider's error page, which the app has no way to explain.

Returns exactly `{ providers: [...] }` from the module's own config — nothing else. Public and unauthenticated on purpose, because the login screen needs it before anyone has signed in; it discloses nothing a visitor could not learn by looking at the buttons, and specifically no client ids, redirect URIs, or module inventory.

Apps were hand-writing this. Doing so means re-reading the same environment variables auth already reads, in a second place, with a second chance to disagree — and naming it `/config`, which collides conceptually with `@fonderie/config` (operator-set feature flags and secrets, a different thing entirely).

Overridable through `config.routes.providers` like every other auth route.

Ships with the whole path, because a route a frontend cannot reach is not a feature: `client.auth.providers()` on the typed client, `useAuthProviders()` in react-auth, and the matching composable in vue-auth (react-native-auth re-exports react-auth's).

Both hooks start EMPTY rather than optimistic, and fall back to empty on error. A brief moment with no social buttons is invisible; a button that appears and then fails is not — and an unreachable API is not evidence that Google works.
