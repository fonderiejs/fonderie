---
'@fonderie/auth': minor
'@fonderie/client': minor
'@fonderie/core': patch
---

Session lifetimes per platform (Phase 3c of `docs/SESSION-DESIGN.md`): a phone stays signed in longer than a browser on a shared computer, and every value can be overridden from the console at any time.

- **Declaring the platform:** the client declares it at sign-in, either `new FonderieClient({ clientKind: 'mobile' | 'desktop' | 'web' })` or the `X-Client-Kind` header (allowed by the default CORS headers, which is the core patch). Auth records it on the session (migration `021`, additive) and uses it at every refresh, so a client can't promote itself later.
- **Presets:**

  | Platform | Idle | Absolute cap |
  |---|---|---|
  | mobile | 90 d | 365 d |
  | desktop | 30 d | 180 d |
  | web | 14 d | 90 d |

  Clients that don't declare a platform keep the shared values, which is today's behaviour.
- **Order, first match wins:**
  1. console per platform (`auth.session.duration.<platform>`, `auth.session.max_age.<platform>`, `auth.access.duration.<platform>`);
  2. console shared;
  3. code per platform (`sessionPolicies`);
  4. code shared;
  5. preset;
  6. default.

  A console shared value therefore applies to every platform at once.
- **`readAuthRuntimeConfig(read)`** builds an app's `resolve` safely: an unset key is absent, never the text `"undefined"` that `String(getConfig(...)) || undefined` produces.
- **The devices list** (`GET /auth/sessions`) now shows each session's `clientKind`.

**Deploy:** migrate, then deploy. `021` only adds a nullable column.
