# @fonderie/auth

## 7.22.0

### Minor Changes

- 4aca9ac: Every built-in email in Chinese, Simplified and Traditional, and amounts written the way the reader writes them.
  
  - **Chinese in both scripts.** All 24 built-in emails (auth 13, billing 10, workspaces 1) ship in `zh-Hans` (Simplified) and `zh-Hant` (Traditional), alongside English, French and Spanish. The Traditional copy is written for Traditional readers (帳戶, 電子郵件, 儲值), not converted character by character.
  - **The script follows the reader.** `zh-TW`, `zh-HK` and `zh-MO` get Traditional; `zh`, `zh-CN` and `zh-SG` get Simplified, derived from CLDR via `Intl.Locale#maximize` with no hand-kept region list. New in core: `localeScriptTag()` and `localeCopyKeys()`. `localeChain()` now puts the script right after the tag (`zh-HK` → `zh-Hant`), so an app's saved `zh-Hant` template also reaches Hong Kong and Taiwan readers, and never Simplified ones. This applies only to languages written in more than one script.
  - **Amounts in the reader's language.** Billing formatted every amount as en-US before anyone knew who would read it, so a Québec customer's French receipt said `CA$19.99`. Notices now also carry the raw amount under core's reserved `$format` data key, and courier formats it in the resolved language: `19,99 $` for fr-CA, `$19.99` for en-CA. The plain string is still sent too, so an older courier shows it unchanged. `$format` accepts `{ money: { amount, currency, precision } }` and `{ date, style? }`.
  - `SHIPPED_TEMPLATE_LANGUAGES` is now `['es', 'fr', 'zh-Hans', 'zh-Hant']`, so the parity checks and `check:template-coverage` require Chinese in every notifying module. The gate's pattern was lower-case only and would have skipped `zh-Hans` while still passing.

### Patch Changes

- Updated dependencies [4aca9ac]
  - @fonderie/core@0.31.0
  - @fonderie/rate-limit@4.0.34

## 7.21.2

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0
  - @fonderie/rate-limit@4.0.33

## 7.21.1

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0
  - @fonderie/rate-limit@4.0.32

## 7.21.0

### Minor Changes

- bd033f5: **Sign in with Google from a native app, and social sign-in now asks for the second factor.**
  
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

## 7.20.0

### Minor Changes

- 149a2dc: **Deleting an account signs out its other devices straight away.** `DELETE /users` now ends every session and emits `fonderie.session.revoked` with `{ sids: null, reason: 'account-deleted' }`, the same live sign-out a password change uses.
  
  Before, the user's other devices stayed signed in until their next request failed, and nothing told them why. `ISessionRevokedEvent['reason']` gains `'account-deleted'`.

## 7.19.2

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0
  - @fonderie/rate-limit@4.0.31

## 7.19.1

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0
  - @fonderie/rate-limit@4.0.30

## 7.19.0

### Minor Changes

- d8eef38: Live sign-out (Phase 5 of `docs/SESSION-DESIGN.md`): when a session is revoked, the device holding it signs out **within a second**, not on its next request.
  
  - **Auth:** `fonderie.session.revoked` is declared in the event catalog. The audience is **only the user it's about**, and the event carries ids only: `{ sids, reason }`, where `sids: null` means every session. It's emitted when:
    - a device is signed out from the devices list (`terminated`);
    - all other devices are signed out (`terminated`);
    - the password changes (`password-changed`, all sessions);
    - an admin uses "sign out everywhere" (`admin`);
    - a refresh token is reused (`refresh-reuse`).
  - **Client:** while signed in, and when `sse` is configured, it listens on the stream it already holds. If the event names **this device's session** (its `sid`) or all sessions, it clears the tokens and cache and calls `auth.onAuthError`. Another device's revocation never signs this one out. Apps without `@fonderie/sse` see no change; `liveSignOut: false` turns it off.

## 7.18.0

### Minor Changes

- e6dc345: Session lifetimes per platform (Phase 3c of `docs/SESSION-DESIGN.md`): a phone stays signed in longer than a browser on a shared computer, and every value can be overridden from the console at any time.
  
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

## 7.17.1

### Patch Changes

- 2c6b2f6: An unreadable session or access-token lifetime now falls back to the default (with one warning) instead of throwing.
  
  **Found in production:** an app's runtime resolver returned `String(undefined)`, the **text** `"undefined"`, as `sessionDuration`. Once refresh used the resolved config (7.17.0), `jsonwebtoken` threw and **every refresh answered 500**. Auth no longer trusts a resolver's lifetime blindly: a value that isn't a duration (`'90d'`, `'1h'`, …) falls back to the default, and an unreadable `sessionMaxAge` is ignored.

## 7.17.0

### Minor Changes

- 7d285e4: Sessions now behave like a messaging app's: an idle device stays signed in. This is Phase 3a of `docs/SESSION-DESIGN.md`.
  
  - **Idle timeout 7 d → 90 d (sliding).** Each refresh extends it. Security comes from revocation (logged-in devices, reuse detection), not from expiry. Set `sessionDuration` to keep the old behaviour.
  - **Access tokens 24 h → 1 h.** They're refreshed silently, so a stolen one is useful for at most an hour. Set `accessTokenDuration` to change it.
  - **Optional absolute cap, `sessionMaxAge`** (e.g. `'365d'`, console key `auth.session.max_age`). A session that old is refused at its next refresh and revoked, however active it is.
  - **`auth_time` claim:** when the user last actually signed in. A sign-in sets it and a refresh carries it, ready for "re-authenticate for sensitive actions" (Phase 3b).
  - **Fix:** a refresh now uses the console-resolved config. Before, `auth.session.duration` set in the console applied at sign-in but was ignored at every refresh.
  
  **Behaviour change:** apps that relied on the defaults get longer sessions and shorter access tokens. Clients that refresh on 401 (`@fonderie/client` does) need no change.

## 7.16.0

### Minor Changes

- f758fbc: Sessions are now devices, with safe refresh rotation. This is Phase 2 of `docs/SESSION-DESIGN.md`.
  
  - **Refresh tokens are hashed at rest** (SHA-256 in `fonderie_sessions.token`), so a database dump no longer contains working refresh tokens. Sessions from before this release keep their raw token until their next refresh hashes them; idle ones expire within the session lifetime.
  - **One row per device:** a refresh rotates the same row and keeps its session ID, so "logged-in devices" stays stable. It tracks `last_used_at`.
  - **Grace for retries and races:** the previous token stays valid for 30 seconds, so a retried or racing refresh succeeds instead of signing the user out.
  - **Reuse detection:** the previous token presented *after* the grace means someone else holds an old copy. The session is revoked and `fonderie.session.revoked` is emitted (`{ userId, sessionId, reason: 'refresh-reuse' }`).
  - **Every token carries a `jti`.** With a stable session ID, two tokens issued in the same second were byte-identical.
  
  **Deploy note: migrate, then deploy.** Migration `020` only **adds** columns, which the previous code ignores, and the new code needs them. It deliberately doesn't hash existing rows: the previous code, still serving during a deploy, looks sessions up by the raw token, so hashing them in the migration would fail every refresh and sign users out until the new code is live.
  
  Tested against a real Postgres in CI (`AUTH_PG_URL`). The rotation, the 30-second grace, 5 concurrent refreshes, reuse revocation, legacy rows hashed on their next refresh, and a migration that leaves raw rows readable for the previous code each have a test; the hashing and reuse tests were checked to fail when their feature is removed.

## 7.15.0

### Minor Changes

- eb9a6d1: The signing secret can now be rotated **without signing anyone out**.
  
  **The incident:** on 2026-09-30, rotating `JWT_SECRET` invalidated every token at once. Phones kept showing signed-in screens with dead tokens, their live streams opened anonymously, and the next API call signed users out mid-use.
  
  **The fix:**
  - **Key IDs:** tokens now carry a key ID (`kid`, derived from the secret, so no extra config).
  - **Verification against previous keys:** verification picks the matching key among `[jwtSecret, ...jwtPreviousSecrets]`, so the old secret keeps verifying while its tokens age out. Tokens issued before this change, without a `kid`, are tried against each key. An unknown or mismatched `kid` is refused.
  - **Readiness:** a weak previous secret is an error, like a weak current one (`JWT_PREVIOUS_SECRET_WEAK`, translated for the console in en/fr/es; that's the client patch).
  - **Env:** `JWT_PREVIOUS_SECRETS` is declared in `env.json`.
  - **Docs:** the rotation runbook is in the README; the session roadmap is in `docs/SESSION-DESIGN.md`.

## 7.14.4

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0
  - @fonderie/rate-limit@4.0.29

## 7.14.3

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0
  - @fonderie/rate-limit@4.0.28

## 7.14.2

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0
  - @fonderie/rate-limit@4.0.27

## 7.14.1

### Patch Changes

- 10d3f42: Every backend brick now ships `env.json`, exported as `@fonderie/<brick>/env.json`, declaring the environment variables it depends on. For each variable the declaration says:
  - where the value comes from: read directly, fed through an option, or set by the host platform;
  - whether it is required, and whether it is a secret;
  - how it is validated and how to generate it;
  - which option it feeds;
  - its all-or-nothing feature groups, such as Sign in with Google or S3.
  
  Bricks that read nothing declare `"vars": []`.
  
  `@fonderie/cli` gains the resolver the upcoming `fonderie env` commands and the admin console build on. It walks an app's `@fonderie/*` dependencies, following their dependencies and required peers but skipping optional peers the app did not install, and merges the declarations into one list. Two bricks declaring the same name with a different kind or secret-ness are an error, never a silent pick.
  
  The monorepo's new `check:env-declarations` CI gate keeps the declarations true:
  - every `process.env` read in a brick's source is declared;
  - every variable declared as read directly is actually read;
  - all bricks resolve together without conflict.
- Updated dependencies [10d3f42]
  - @fonderie/rate-limit@4.0.26

## 7.14.0

### Minor Changes

- 4a4541f: The admin console now shows every server message in the operator's language:
  readiness problems, doctor findings and "skipped" reasons.
  
  Until now the console chrome was translated, but what the bricks reported was
  English prose. A French-speaking operator reading about a missing DMARC record
  or a price mismatch got English. Those findings are the part they most need to
  understand.
  
  Each finding now carries a stable `reason` (UPPER_SNAKE), its `domain` (the brick
  that emitted it) and `metadata` (the raw values). This is the AIP-193 ErrorInfo
  shape the API errors already use. The English `message` stays as the fallback.
  
  - **core** — `IFinding`. `IReadinessProblem` gains `reason`, `domain` and
    `metadata`. `IAdminCheckReport.findings` accepts `string | IFinding`, and so
    does `skipped`. Plain strings still work.
  - **auth, billing, config, courier, events** — every readiness problem, check
    finding and skip reason now carries a reason: 54 in all.
    - Enum-like values are UPPER_SNAKE, for example the subscription-drift
      `impact`, so no English leaks through a parameter.
    - billing adds `priceFindings`, `webhookFindings` and
      `subscriptionDriftFindings`. courier adds `senderDnsFindings`.
    - The `describe*` functions still return the English lines.
  - **admin** — the doctor results add `details` (the findings in order, each with
    its own severity) and `skippedDetail`, next to the unchanged English
    `findings` and `skipped`.
    - Attention items carry reason, domain and metadata. Each one also has its
      own severity, so an SPF suggestion is no longer shown as an error.
    - New `migrationsCheck(store, sets)` gives apps a translated
      pending-migrations doctor check.
  - **client** — `localizeReason(item, locale)`, plus French and Spanish sentences
    for every reason. An unknown reason (a newer brick or an app's own check)
    falls back to the English message.
  - **react-admin-screens, vue-admin-screens** — the Attention, Doctor, Modules
    and Environment pages render the translated sentence. They colour each
    finding by its own severity.
  
  CI adds `check:reasons`, which checks two things:
  
  - every emitted domain + reason has an English sentence;
  - every sentence is still emitted.

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0
  - @fonderie/rate-limit@4.0.25

## 7.13.0

### Minor Changes

- 973faad: Built-in emails in English, French and Spanish, and locale fallback chains the app declares once.
  
  - **core** — `locales: { default, fallbacks }` in the app config: the system locale (default `en-US`) and, per market or language, where content comes from when that market has none (`fr: 'fr-CA'`, `'fr-BE': ['fr-FR', 'fr-CA']`). Chains don't expand, so a market's path reads in one line. A bad chain (invalid tag, a locale falling back to itself, more than five fallbacks) stops the app at construction. New: `defineLocales`, `localeChain`, `canonicalLocale`, `app.locales`, plus `withTranslations` / `translationProblems` for modules shipping translated defaults.
  - **courier** — resolution order: the app's saved versions along the chain, then the built-in copy by language, then the saved default, then the built-in English. The system locale comes last so a French user gets the shipped French rather than the app's English default. The built-in layout shell is drawn in the email's language. Every send records the version actually used (`fonderie_message_log.resolved_locale`, migration 005 — run migrations with this release; until then sends still work and only that detail is skipped). Template tags are stored canonical, and a version tagged with the system locale is refused (409 `DEFAULT_LOCALE`): the default copy already is that version.
  - **auth / billing / workspaces** — every built-in email ships in French and Spanish, with a coverage test that fails when a translation's subject, text or html uses different `{{variables}}` than the English.
  - **auth / client** — sign-up accepts `locale`, stored on the new account, so the verification email already arrives in it; without one, new accounts get the app's system locale instead of a hard-coded `en-US`.

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0
  - @fonderie/rate-limit@4.0.24

## 7.12.0

### Minor Changes

- 2c350b5: Deleting an account now stops its billing, and purging it erases the payment provider's copy.
  
  Before: `@fonderie/auth` soft-deleted the user and emitted `fonderie.user.deleted`, but nothing listened — an active subscription kept renewing on a card the person could no longer sign in to cancel.
  
  - **Billing, on `fonderie.user.deleted`** (needs the event bus): cancels the user's subscription at the provider — immediately by default; `onSubscriberDeleted: 'cancel-at-period-end' | 'keep'` to change that — and disarms off-session charging (auto-recharge off, stored card and any pending recharge key forgotten). No automatic refund; the app decides. Workspace subscriptions are untouched. Idempotent: an "already canceled" answer from the provider is success, a real failure throws so the bus redelivers.
  - **Billing, on `fonderie.user.purged`:** deletes every provider customer record the user had (subscription and wallet customers) — the email and saved cards. The provider keeps its invoices; local subscriptions, ledger and balances stay as financial records keyed by an id that no longer resolves to a person. New optional provider method `deleteCustomer` (Stripe: `customers.del`, already-deleted is a no-op).
  - **Auth:** `purgeSoftDeletedUsers` / `startUserRetention` take an optional `bus` and emit `fonderie.user.purged` { userId } for each hard-deleted account, after the delete. `EVENT_KEYS.userPurged`. The admin user lookup by id resolves soft-deleted accounts (with `deletedAt`); `GET /_admin/users?deleted=1` lists only them.
  - **Client / hooks:** `listUsers({ deleted: true })`; `useAdminUsers` passes it through.
  - **Console:** Users gets an Active / Deleted switch; a deleted account shows "Deleted on …" instead of account actions, sessions and sign-ins, and keeps its Plan & credits.

## 7.11.1

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0
  - @fonderie/rate-limit@4.0.23

## 7.11.0

### Minor Changes

- cb2ea60: Locations carry `geonameId` — MaxMind/GeoNames' stable, language-neutral key
  for the place resolved. Stored names are a snapshot in one language; the id
  lets any reader see a login's place in their own language later, and lets an
  app map places onto its own regions (markets, provinces, pricing zones).
  `PostgresGeoProvider` returns it from the City block; `geoFromHeaders` returns
  `null` (platforms send names, not a key). Auth sanitizes it to a positive
  32-bit integer, accepting node-pg's BIGINT-as-string.

## 7.10.0

### Minor Changes

- 8983e77: `IRequestLocation.accuracyRadius` (kilometres) — how approximate a stored
  location is. Resolvers backed by MaxMind or an IP-intelligence API report it;
  it was being dropped on write. Sanitized to a positive whole number of at
  most 20,000 km. `@fonderie/geo`'s `PostgresGeoProvider` already returns it;
  `geoFromHeaders` returns null (the platforms send no radius).
- 3446009: Auth events can say where they came from. `IAuthConfig.location` is an
  optional resolver `({ ip, headers }) => IRequestLocation | null`, called at
  most once per request. Its result is stored on every login-attempt row, on a
  new `registration` row written at sign-up, and on each new session (nullable
  `location` JSONB columns — migrations 018 and 019, run your migrations), and
  returned as `location` on login-history events and active sessions. Absent
  resolver ⇒ `location: null`, behaviour unchanged apart from the new
  `registration` rows in login history.
  
  Registration is recorded because with verification not enforced the account
  is live from that request: it is the first record of where the user came from.
  
  Auth imports no geo code: on Vercel/Cloudflare pass
  `({ headers }) => geoFromHeaders(headers, { trust })` from `@fonderie/geo`; a
  self-hosted table or an IP-intelligence API fits the same contract and may add
  ISP/ASN/proxy/hosting. Output is treated as untrusted: type-checked and
  bounded, coordinates rounded to ~1 km, re-sanitized on read;
  a resolver that throws or exceeds 500 ms leaves the row without a location.
  
  Client: `IRequestLocationDTO`, `location` on `ILoginEventDTO` and
  `ISessionDTO`, and `describeLocation(loc, countryName?)` ("Mountain View, CA, US");
  the auth hook packages re-export the type. The admin console shows location
  next to the IP for live sessions and recent sign-ins, with a proxy/VPN or
  hosting flag when known.
  
  Postal / ZIP code is kept when the resolver knows it (`postalCode`), and
  `@fonderie/geo`'s `geoFromHeaders` now reads it from Vercel's
  `x-vercel-ip-postal-code` and Cloudflare's `cf-postal-code`. It is approximate
  for an IP, so `describeLocation` leaves it out of the one-line display.

## 7.9.4

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.

## 7.9.3

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0
  - @fonderie/rate-limit@4.0.22

## 7.9.2

### Patch Changes

- 34aef24: Every module reports its version, so the Modules page can answer
  
  `IFonderieModule.version` is optional, and `@fonderie/admin` was the only
  module that set it. The operator's Modules page exists to answer "what is
  actually deployed here" and answered it for one module out of six — every
  other row read "not reported", which is honest and useless.
  
  `tsup.base` now bakes `FONDERIE_PKG_VERSION` into every build (tsup runs with
  cwd set to the package being built, so it reads the right `package.json`
  without each config passing its own), and each module reports it. Admin drops
  its bespoke `FONDERIE_ADMIN_VERSION` for the shared one.
  
  A test walks `packages/*/src/module.ts` and fails when a class implementing
  `IFonderieModule` does not report a version — it caught `@fonderie/logger`,
  which was missing from the first pass.

## 7.9.1

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0
  - @fonderie/rate-limit@4.0.20

## 7.9.0

### Minor Changes

- 3aab737: The Users page lists on arrival instead of demanding an email first
  
  `GET /_admin/users` required `?email=` and answered 422 without it, so the
  operator screen opened as an empty box: you could only see an account you could
  already name. Nobody can answer "who signed up this morning" that way, and it
  is the opposite of what an operator surface is for.
  
  Without `email` the route now returns a keyset-paginated page, newest first —
  the same cursor contract as login history and the audit log, `{ users,
  nextCursor }`. With `email` it is the exact lookup it always was, unchanged.
  Not a new route, so the token scope stays `read`, derived as before.
  
  Ships `AuthAdminClient.listUsers()`, `useAdminUsers` for React and Vue, and the
  Users screen listing with Load more; clicking a row, or looking up an email,
  opens the account detail as before.
  
  Includes an index on `fonderie_users (created_at DESC, id DESC)` — **run the
  auth migrations**. Keyset paging orders by that pair and the table had only an
  email index, so every page would otherwise sort the whole table.
  
  The list is the same allowlist DTO as the lookup: `passwordHash` and
  `mfaSecret` cannot appear, and a test asserts it against the list response too.

## 7.8.1

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0
  - @fonderie/rate-limit@4.0.19

## 7.8.0

### Minor Changes

- 223a934: Describe the operator's user routes for `@fonderie/admin`
  
  `describeAdmin()` offers, under the admin prefix and behind its one token:
  `GET /users?email=`, `GET /users/:id`, `GET` and `DELETE
  /users/:id/sessions` (sign out everywhere), `GET /users/:id/login-history`
  (paged like the user's own), and `POST /users/:id/suspend` /
  `unsuspend`. The lock is `users.suspended`, which login, refresh and the
  session middleware already enforce — it only lacked a switch.
  `UserModel.setSuspended(id, suspended)` is that switch.
  
  The admin view is the app's own user DTO plus `suspended`, `deletedAt`,
  `createdAt`; never the password hash or an MFA secret. There is no
  standalone surface: these routes exist only when `@fonderie/admin` is
  installed, and every call lands in its admin log. Phase 8a of
  `docs/ADMIN-BRICK-DESIGN.md`.

## 7.7.4

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0
  - @fonderie/rate-limit@4.0.18

## 7.7.3

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0
  - @fonderie/rate-limit@4.0.17

## 7.7.2

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0
  - @fonderie/rate-limit@4.0.16

## 7.7.1

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0
  - @fonderie/rate-limit@4.0.15

## 7.7.0

### Minor Changes

- 8ab15a4: Phone sign-ins now appear in login history.
  
  A phone sign-in COMPLETES in `verify()`, not `login()`: `/auth/login` only sends
  the code and issues a short-lived pending token, because possession of the phone
  is the sole credential and issuing real tokens earlier would authenticate anyone
  who typed a number.
  
  Login history enumerated the login routes — `login()` and the OAuth callbacks —
  and never looked in a route named `verify`. The phone flow predates that feature
  by four months, so it was simply never covered. The security screen showed every
  other method and silently omitted this one, which is worse than showing nothing:
  an owner reading it concludes there were no phone sign-ins.
  
  Success and both failure paths are recorded (`invalid_pin`, `expired_pin`) with
  the caller's IP and user-agent. The failures matter most — a run of them is what
  tells an owner someone is guessing at their phone login.
  
  No migration: `fonderie_login_events.method` is an unconstrained TEXT column.
- 4d0441b: Warn when a security event is recorded with no caller identity at all.
  
  A real HTTP request arriving through an adapter carries a user-agent and a
  resolved client IP. BOTH being absent means the context was built by hand —
  almost always `fonderie.handle(new Request(...))` called directly, with the
  caller's headers dropped and no `{ meta: { clientIp } }` seed.
  
  Nothing fails. The sign-in works, the session opens, and the damage only
  appears later in login history: "Unknown device" with no IP, and only for the
  affected method — which reads as a display bug rather than missing security
  data. It happened on an OAuth callback, so the blank rows were exactly the
  sign-ins whose history matters most.
  
  Reported once per process, because the condition is a property of how the app
  is wired rather than of any one request, and repeating it per login would bury
  it. The message names both halves of the fix: forward the user-agent header,
  and pass the resolved IP as `handle(req, { meta: { clientIp } })` — resolved
  with `resolveClientIp` from `@fonderie/core/middlewares` rather than read off
  the socket, or a proxied deployment records the proxy.
  
  Only one of the two missing is deliberately NOT reported: a request can lack a
  user-agent, and an IP can be unresolvable on some transports. Both missing
  together is the signature worth flagging, and keeping it that narrow is what
  stops the warning becoming noise people mute.

## 7.6.1

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0
  - @fonderie/rate-limit@4.0.14

## 7.6.0

### Minor Changes

- 081d8fd: Security: linking an OAuth identity now revokes an **unverified** password on
  the account it links into.
  
  Linking is by email, which is what makes "one person, one account" work — but
  it means the provider merges into whatever row already holds that address, and
  anyone can register an address they do not own. Only verification proves
  otherwise.
  
  The sequence that was exploitable:
  
  1. someone registers `victim@example.com` with a password and never verifies
  2. the real owner later signs in with Google as `victim@example.com`
  3. `upsertByProvider` merges into the existing row — the provider's
     `email_verified` claim only proves the *provider* side
  4. the same statement sets `email_verified_at`, so the account is now treated
     as verified
  5. the earlier registrant's password still works, on a now-trusted account
  
  Enabling `requireVerification` does not close this. It gates an account while
  unverified, and step 4 is exactly the moment that gate lifts.
  
  So an unverified password is now dropped at the moment of linking. Read it as:
  a password on an unverified account is a *claim*, not a credential — nobody
  ever proved that mailbox belongs to whoever set it, and the provider has just
  proven it belongs to the person signing in.
  
  **This does revoke a credential**, in one case only: the prior row existed,
  had a password, and had never been verified. A verified account linking a
  provider keeps its password — the ordinary "I use both" flow is untouched, and
  so is a returning OAuth user.
  
  Legitimate users lose one password reset and nothing else; they own the
  mailbox, so the reset reaches them. Someone who does not own it cannot receive
  that mail, which is the point.
  
  The owner is told. A `password-revoked` notice ships with a default template
  and is sent to the address the provider just proved ownership of — so it
  reaches the right person, and a password that silently stops working is no
  longer something the user has to diagnose. It fires ONLY on an actual
  revocation; claiming one that did not happen would be worse than silence.
  
  `upsertByProvider` also returns `clearedUnverifiedPassword` for callers that
  want to react themselves.

## 7.5.0

### Minor Changes

- 5db8bbe: Let users disconnect an OAuth provider, and make an OAuth sign-up behave like
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

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0
  - @fonderie/rate-limit@4.0.13

## 7.4.0

### Minor Changes

- fd87133: Add `GET /auth/providers` — which sign-in methods this deployment can actually honour.
  
  A login screen has to decide which buttons to draw, and the only honest source is the side holding the credentials. The alternative is a build-time flag in the frontend, which stores the same fact twice and lets the two disagree: the app offers a provider the server cannot complete, and the user lands on the provider's error page, which the app has no way to explain.
  
  Returns exactly `{ providers: [...] }` from the module's own config — nothing else. Public and unauthenticated on purpose, because the login screen needs it before anyone has signed in; it discloses nothing a visitor could not learn by looking at the buttons, and specifically no client ids, redirect URIs, or module inventory.
  
  Apps were hand-writing this. Doing so means re-reading the same environment variables auth already reads, in a second place, with a second chance to disagree — and naming it `/config`, which collides conceptually with `@fonderie/config` (operator-set feature flags and secrets, a different thing entirely).
  
  Overridable through `config.routes.providers` like every other auth route.
  
  Ships with the whole path, because a route a frontend cannot reach is not a feature: `client.auth.providers()` on the typed client, `useAuthProviders()` in react-auth, and the matching composable in vue-auth (react-native-auth re-exports react-auth's).
  
  Both hooks start EMPTY rather than optimistic, and fall back to empty on error. A brief moment with no social buttons is invisible; a button that appears and then fails is not — and an unreachable API is not evidence that Google works.

## 7.3.6

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0
  - @fonderie/rate-limit@4.0.12

## 7.3.5

### Patch Changes

- 3f02a51: The durable outbox is now usable from a serverless producer, and a failing queue is no longer invisible.
  
  `PGTransport.start()` bundled four things: connecting the store (needed to publish), resetting orphaned rows, opening a `LISTEN` client, and starting a poll loop that never returns. A serverless API needs only the first — but taking all four means every instance opens a `LISTEN` connection, which a transaction-mode pooler (Supabase's 6543) rejects outright, plus a loop the invocation cannot host. There was no way to say "connect me as a producer", so publishing durably from serverless was impossible. `consume: false` now stops after the store is connected. `drain()` still works in that mode, so a scheduled ping can consume without anything long-running.
  
  `deadLetters()` and `pendingCount()` expose what the outbox knows but nothing surfaced. A dead row is the end of the line — durable, retried, and never to be delivered — yet a queue that has silently stopped delivering looked exactly like one with nothing to do, which is the failure mode an outbox exists to eliminate. Both answer emptily before the transport connects, so a health route can call them unconditionally.
  
  Two remaining detached dispatches are fixed. `LoginEventModel.recordSafe` is now awaitable: it still never throws, but it is a security audit trail (who signed in, from where, from which IP), and a detached write is abandoned when a serverless instance freezes after the response — losing the row entirely rather than merely its IP. Billing's low-balance customer email went through `notifyBilling` rather than the bus, so the earlier sweep did not match it; it has the same exposure and now routes through `background()` too.

## 7.3.4

### Patch Changes

- c63f35b: Notifications, webhooks and domain events are no longer silently dropped on serverless.
  
  Work dispatched off the request path was detached (`bus?.emit(...).catch(() => {})`). On a long-running host that promise finishes in the background; on serverless it does not — the instance is frozen the moment the response is written, so the work is abandoned mid-flight. A registration returned "Account created. Check your email" while the verification email was never sent, and nothing appeared in the logs, because the code that would have reported the failure never ran either. The same applied to payment receipts, dunning notices, low-balance warnings, workspace invitations and customer events.
  
  Core gains `background(work)`, and 43 dispatch sites across auth, billing, customers and workspaces now go through it. Its behaviour is chosen by `FONDERIE_BACKGROUND_TASKS`:
  
  - `auto` (default) — wait on serverless, detach anywhere else
  - `await` — always finish the work before responding
  - `detach` — never wait; only safe where the process outlives the response
  
  Detection is a positive list of serverless markers (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`, `FUNCTION_TARGET`, `K_SERVICE`, `FUNCTIONS_WORKER_RUNTIME`), never an attempt to recognise a long-running host — there is no reliable signal for "this process outlives the response", so EC2, Docker and bare metal are the fallback and keep today's behaviour exactly. An unrecognised serverless platform is no worse off than before, and can opt in explicitly.
  
  Awaiting is bounded by `FONDERIE_BACKGROUND_TIMEOUT_MS` (default 5000) so a hung provider degrades to lost work rather than a hung request, and rejections are still swallowed — background work must never fail the request that triggered it. `setBackgroundRunner()` lets an adapter or app supply a platform primitive such as Vercel's `waitUntil`, which is strictly better than either mode: the work completes without delaying the response.
  
  Deliberately unchanged: `.catch(() => {})` used for cleanup and compensation inside an already-awaited flow (invoice teardown, orphaned-blob removal) is error swallowing, not detached work, and wrapping it would change its meaning. `LoginEventModel.recordSafe` is also still detached — making it awaitable changes a synchronous signature and its call sites, so it is left for a follow-up.
  
  
  `@fonderie/events` gains `drain()` on the bus and the Postgres transport. `start()` is the right consumer on a host that outlives the request — it `LISTEN`s and delivers immediately — but it never returns, so it cannot be used where the process must. `drain()` is the same work, bounded by `maxMs`, so a scheduled ping consumes the outbox with no long-running process at all.
  
  That is what makes the durable path topology-independent, and it is the difference between mitigating this bug and solving it: producers always write a durable row, and the deployment picks a consumer — `start()` or `drain()` — without either side's code changing. `background()` remains the safety net for apps that register no durable transport; where one exists, the outbox is strictly better, because it survives a crash and retries, which awaiting cannot.
- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0
  - @fonderie/rate-limit@4.0.11

## 7.3.3

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0
  - @fonderie/rate-limit@4.0.10

## 7.3.2

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0
  - @fonderie/rate-limit@4.0.9

## 7.3.1

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0
  - @fonderie/rate-limit@4.0.8

## 7.3.0

### Minor Changes

- 39cdb13: Security hardening for Sign in with Apple (post-audit; SOC2-oriented — no
  Critical/High findings, these close the Medium/Low items).
  
  - **Native replay protection (single-use tokens):** a verified native
    `identityToken` (POST /auth/apple/native) is now redeemable exactly once —
    consumed by hash with TTL = the token's own exp (new `fonderie_consumed_tokens`
    table, atomic INSERT … ON CONFLICT). Apple doesn't one-time the id_token for
    us, so this stops a captured token from being replayed until it expires. A
    replay is recorded as an `oauth-apple` failed-login security event. Non-breaking:
    the optional client `nonce` remains supported for session-binding but is not
    required. New migration `016_consumed_tokens.sql`.
  - **JWKS fetch hardening:** the Apple public-key fetch is now single-flighted,
    rate-limited to at most one refetch per minute (so a flood of attacker-chosen
    `kid`s can't force one outbound call to Apple per request), and bounded by a
    5s timeout.
  - **Rate-limited web callbacks:** `POST /auth/apple/callback` and
    `GET /auth/google/callback` now carry the login IP limiter (an unauthenticated
    caller could otherwise force one outbound token-exchange per request).
  - **Account linking:** OAuth link now sets `email_verified_at` on the
    conflict/link branch (`COALESCE(existing, now())`) so an existing unverified
    account linked via a provider that asserts a verified email is marked verified.
  - **Config guard:** `apple.nativeClientIds` with an empty or wildcard entry is
    now a boot-blocking error (it's the native-audience allow-list; a wildcard
    would accept identity tokens minted for other apps).

## 7.2.0

### Minor Changes

- 048138e: Sign in with Apple — a second OAuth provider alongside Google, wired behind
  `providers: ['apple']`. Required for App Store apps that offer any third-party
  login (Apple Guideline 4.8).
  
  - **Config:** `apple?: { clientId (Services ID), teamId, keyId, privateKey (.p8),
    redirectUri, nativeClientIds? }`. The client secret is not a static string —
    it's a short-lived **ES256 JWT** minted from the `.p8` key per token exchange.
  - **Web flow:** `GET /auth/apple` → Apple → `POST /auth/apple/callback`
    (`response_mode=form_post`). The CSRF `state` cookie is `SameSite=None; Secure`
    (a `Lax` cookie — Google's — is not sent on Apple's cross-site POST).
  - **Native (iOS) flow:** `POST /auth/apple/native` takes the `identityToken` from
    the native Apple sheet. Because that token's `aud` is the app's **bundle id**
    (allow-listed via `nativeClientIds`) and it did not come from our own TLS
    exchange, its signature is **verified against Apple's JWKS** — with `iss`, `aud`,
    `exp`, `email_verified`, and optional `nonce` all checked.
  - Accounts link **by verified email** (`upsertByProvider`), reusing Google's
    account-linking posture; login history records `oauth-apple`. No DB migration
    (`provider` is already a free-form column).
  
  All routes are config-gated — apps that don't set `apple` are unaffected.

## 7.1.1

### Patch Changes

- 9156a68: Hash the password-reset PIN and token at rest. They were stored plaintext, so a DB read (SQLi elsewhere, a backup/log leak) yielded directly-usable reset credentials within the 1h window. Both are now stored as their SHA-256 hash and looked up by hash; the reset email still carries the raw values, only storage changed. SHA-256 is sufficient — the token carries 256 bits of entropy and the pin's protection is its route rate-limiter + short TTL + all-session-revoke. In-flight resets created before upgrade won't verify (users re-request); no data migration needed.

## 7.1.0

### Minor Changes

- 9fbf074: Add a high-entropy reset-token path alongside the 6-digit reset PIN. Forgot-password now also mints a 32-byte token (stored beside the pin) and emits it — plus a ready-built `resetUrl` when the new `config.passwordResetUrl` base is set — in the `password-reset` notification payload, so a template can offer a click-to-reset link instead of only the code. `POST /auth/email/reset` accepts `{ token, password }` or `{ pin, password }`; the token is looked up directly and, being non-brute-forceable, needs no rate limit (the pin path keeps its IP limiter). Blank/short tokens are refused before the query so a NULL token column can never be matched. Purely additive: with `passwordResetUrl` unset, behaviour is unchanged (pin only, `resetUrl` empty). Ships migration `015_password_reset_token` (re-adds the nullable `token` column + a partial unique index).

## 7.0.1

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0
  - @fonderie/rate-limit@4.0.7

## 7.0.0

### Major Changes

- cd2706a: Google OAuth hardening (BREAKING: the callback now requires the CSRF `state`). (1) Login CSRF: `GET /auth/google` now generates a random `state`, binds it to the browser via a short-lived `oauth_state` cookie (HttpOnly, SameSite=Lax), and puts it in the auth URL; the callback rejects any request whose echoed state doesn't match the cookie — without this, an attacker could complete the callback with a code from their own Google account and silently log the victim's browser into the attacker's account. Standard browser flows keep working unchanged; non-browser scripts driving the flow must now carry the cookie. (2) id_token claim checks: `aud` must equal the configured client id, `iss` must be Google, `exp` must be in the future. (3) Account linking is by email (`upsertByProvider`), so the callback now requires `email_verified: true` — an unverified Google email could otherwise take over an existing account registered with that address. (4) Password reset now revokes **all** of the user's sessions in the same transaction — a reset exists because the account may be compromised, and a stolen session must not survive it.

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0
  - @fonderie/rate-limit@4.0.6

## 6.0.0

### Major Changes

- 2a22d14: Phone OTP is now a real login factor (BREAKING for the phone branch of `POST /auth/login` / `POST /auth/register`). Previously both phone flows issued a full access+refresh token pair (and a session) *before* the OTP round-trip — but possession of the phone is the only credential in this flow, so knowing a registered number was enough to authenticate as its owner. The phone branches now return `202 { result: { otpToken } }` — a short-lived pending token (the same mechanism as MFA) that only `/auth/verify` and `/auth/send-verification` accept; the real token pair is issued by `/auth/verify` once the OTP matches (that path already existed and is unchanged). The phone-login response no longer includes the user DTO (profile PII was returned to any caller who typed a registered number). `/auth/verify` and `/auth/send-verification` moved from `requireAuth` to `requireAnyAuth` to admit the pending token, and both reject a pending token for any *other* flow (an email MFA-pending login cannot side-step into email verification). `/auth/verify` also gained a per-IP rate limit (10/15 min, on by default, configurable via `config.rateLimit.rules.verify`) — it checks a 6-digit code, and in the phone flow that code is the login credential. Adds `verify` to `AuthLimitedRoute`. The email login/register flows are unchanged. Note: the typed client never surfaced phone auth, so `@fonderie/client` and the hook packages are unaffected.

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0
  - @fonderie/rate-limit@4.0.5

## 5.3.0

### Minor Changes

- fc6b4c4: Rate-limit password reset. `POST /auth/email/reset` verifies a 6-digit PIN that is looked up globally, so an unthrottled endpoint was brute-forceable into an account takeover. The route now carries a per-IP limiter (10 / 15 min by default), on by default like login and forgot-password, and configurable/disable-able through `config.rateLimit.rules.reset`. Adds `reset` to `AuthLimitedRoute`. (Moving the reset flow to a high-entropy opaque token is tracked as a follow-up.)

## 5.2.0

### Minor Changes

- afb418c: Read/manage APIs for login activity. `@fonderie/auth` adds four caller-scoped routes: `GET /auth/login-history` (the caller's own attempts, newest first, keyset-paginated on `(created_at, id)` — the same cursor contract as audit's event log, reused from `@fonderie/core`); `GET /auth/sessions` (live sessions, with the current one flagged via the request's `sid`); `DELETE /auth/sessions/:id` (revoke one session, scoped to its owner); and `DELETE /auth/sessions/others` (revoke every session except the current). Because access tokens are already bound to their session's `sid`, terminating a session revokes its access token on the next request, not just its refresh. `@fonderie/client`'s `AuthClient` gains `getLoginHistory`, `listSessions`, `terminateSession`, and `terminateOtherSessions`, sharing the existing auth token.
- afb418c: Capture login activity for security surfaces. `fonderie_sessions` now persists `ip_address` and `user_agent` on every session create (previously these columns existed but were always NULL — a bug that left the SAR export and any session UI blank). A new append-only `fonderie_login_events` table records one row per login attempt — success or failure — across the password, MFA, and Google-OAuth paths, with `method`, `outcome`, `failure_reason`, IP, and user-agent; `user_id` is nullable so attempts against unknown emails still record. Recording is fire-and-forget: a logging failure can never block or fail a login. This is the data layer for the forthcoming login-history and active-sessions read APIs; no new routes yet.

### Patch Changes

- afb418c: Fix: logout now revokes the current session by its `sid`, not only by a resent refresh token. Because clients typically persist only the access token, `POST /auth/logout` previously received no refresh token and deleted nothing — the session row survived logout (lingering in `GET /auth/sessions`) and its refresh token stayed valid until expiry. Logout runs under `requireAuth`, so the access token's `sid` already identifies the session; it is now deleted directly, which also invalidates that access token via the existing sid-liveness check. An explicitly-passed refresh token is still honoured.

## 5.1.0

### Minor Changes

- 16ec091: Ship default email/SMS templates for every auth notification (P1 of the notification-template normalization).
  
  `@fonderie/auth` now exports `DEFAULT_TEMPLATES` — built-in copy for all nine message keys (`email-registration`, `email-verification`, `password-reset`, `phone-otp` (SMS, text-only), `mfa-enabled`, `mfa-disabled`, `mfa-backup-codes-regenerated`, `email-changed`, `phone-changed`). Pass it to courier via `config.templates.defaults` and auth's notifications render out of the box — no per-app template authoring, and never the raw-JSON fallback. Any single key is still overridable per-app with a DB row / FS file.
  
  The map is `satisfies Record<AuthMessageKey, IDefaultTemplate>`, so adding a message key without a default is a compile error. A coverage test asserts every key's default renders cleanly with its real payload (no variable/payload drift, no unresolved `{{…}}`), and that the map is assignable to courier's `DefaultTemplateMap` (the app-wiring contract). Requires `@fonderie/core >= 0.8.0` and `@fonderie/courier >= 5.2.0` (the default-template mechanism). Additive — no behavior change for apps that don't wire `templates.defaults`.

## 5.0.4

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0
  - @fonderie/rate-limit@4.0.3

## 5.0.3

### Patch Changes

- f3656f8: Consolidate three cross-package duplications into shared @fonderie/core primitives (from the consolidation audit).
  
  - **`constantTimeEqual(a, b)`** (new core export) — the one timing-safe compare. Replaces byte-identical copies in auth (MFA/TOTP codes), events (event-log HMAC), courier (SendGrid/Mailgun webhook-signature verification), and core's own admin-token guard. Prevents any copy silently dropping the length-guard or swapping to `===` and reintroducing a per-module timing side-channel.
  - **`secretStrengthProblem` / `PLACEHOLDER_SECRET` / `MIN_SECRET_LENGTH`** (new core exports) — one weak/placeholder-secret denylist. auth's `jwtSecret`/`clientSecret` checks and core's `validateAdminToken` now share it (the two regexes had already drifted by one term). Call-site policy (required vs optional, field name) stays per-module.
  - **`encodeKeysetCursor` / `decodeKeysetCursor`** (new core exports) — one keyset-pagination cursor over `(created_at, id)`. billing's wallet ledger and audit's event log now share it. **Fixes a real bug in `@fonderie/audit`**: its local decode lacked timestamp field-range checks, so a crafted in-shape-but-out-of-range cursor reached the `::timestamptz` cast as a **500**; it now decodes to null (the model drops the keyset predicate and returns the first page) instead of 500ing. audit's opaque cursor wire format changes to the shared one (in-flight cursors restart pagination — acceptable for an opaque cursor).
  
  Behavior-preserving elsewhere (billing's public `encode/decodeLedgerCursor` are kept as aliases; auth also adopts the existing `dateOrEmpty` for session/user timestamps, fixing a latent `''`-for-string-input inconsistency). Adversarially reviewed; no public API removed.
- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0
  - @fonderie/rate-limit@4.0.2

## 5.0.2

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0
  - @fonderie/rate-limit@4.0.1

## 5.0.1

### Patch Changes

- 98821fc: Auth mediums from the DTO audit: honest SAR exports, typed preferences, the verify-routing signal
  
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
- 473a632: DTO audit closeout: config value parity, actor attribution, and the last shape lies
  
  Config admin responses now serve the PARSED value the runtime read path
  serves — previously `setConfig(key, { value: { a: 1 } })` read back as the
  string `'{"a":1}'` and the shipped editor re-stringified it into a
  degradation loop on every save. Writes honor `active: false` instead of
  silently forcing `true` (list reads filter on it), and both admin clients
  accept an `actor` option sent as `X-Actor` on writes, so `updatedBy` and
  revision history can attribute changes to a person instead of
  'admin-token'. `HttpClient` gained per-request extra headers to carry it.
  
  Workspaces: `updateWorkspaceSchema`'s address validated `region`/
  `postalCode` — names nothing writes — while the real `state`/`zip` rode
  through `.passthrough()` unvalidated; the schema now matches the persisted
  shape and strips unknowns. `IWorkspaceDTO` exposes `archivedBy` (fetched by
  every query, dropped by the mapper) beside `isArchived`/`archivedAt`.
  
  Webhooks: `IWebhookDeliveryDTO` carries `payload`, `responseBody`, and
  `nextAttemptAt` — all fetched, all previously discarded, all exactly what a
  delivery-history UI needs to debug a failing endpoint.
  
  Customers: the email/phone/address update schemas shrink to the one field
  the controllers apply (`label`) — content changes are remove-and-re-add and
  `setPrimary` has its own route, so the old wider schemas validated bodies
  that were silently ignored.
  
  Auth: `mfa_secret` no longer rides along on every user fetch — `USER_COLUMNS`
  drops it and `mfa.disable` fetches on demand via `getMfaSecret` like
  `mfa.verify` always did (removing an untyped cast). `IUpdateProfileInput`
  models explicit-null clears like the workspaces input already did, and the
  client documents that the server's phone-auth register/login variant is a
  deliberate deferral to its own feature cycle.
- 98e13c1: Constant-time secret comparisons everywhere a secret is compared
  
  An audit of every token/secret equality check found two spots still using
  plain string comparison while config and billing already use
  `crypto.timingSafeEqual`: courier's template-admin Bearer guard compared
  `token !== adminToken` (its comment claimed to mirror config's admin
  surface, but the mirror missed the constant-time compare), and auth's TOTP
  verification compared the six-digit code with `===`. Both now use the same
  length-guarded `timingSafeEqual` pattern, closing the response-timing oracle
  that would let an attacker recover a match byte-by-byte. No behavior change
  for correct or incorrect credentials.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/events@5.0.0
  - @fonderie/rate-limit@4.0.0

## 4.0.0

### Minor Changes

- 4e82ef4: Production-readiness guard: `AuthModule` now validates its config on construction
  and **refuses to boot in production with a weak `jwtSecret`** (< 32 chars or a
  placeholder/dev-default like `dev-secret-…`) — a forgeable token is an auth
  bypass, so this fails closed. Outside production the same issues are a loud
  warning, so dev/test are unaffected. Also warns on `secureCookies: false` in
  production. Exported as `validateAuthConfig` for an app's own preflight.

  Note: an app currently deploying with a weak secret in production will now fail
  to boot — that deployment was already insecure; set a real secret
  (`openssl rand -base64 32`).

- 464f2e2: Add `importUser` — the write-side of migrating an existing user base onto
  Fonderie auth. `UserModel.create` is for fresh sign-ups (new id, default
  timestamps); `importUser(store, user)` instead **preserves identity**: the
  original id (so foreign keys still resolve), `createdAt`, `emailVerifiedAt`, and
  the legacy password hash. Pair it with the `legacyVerify` config option — import
  the foreign hash as-is, and Fonderie upgrades it to bcrypt on first login
  (rehash-on-login). Supplied fields are preserved; omitted ones take the table
  defaults.
- ca700b2: Add `legacyVerify` — rehash-on-login for apps migrating onto Fonderie auth. Set
  `legacyVerify: (plain, hash) => boolean | Promise<boolean>` on the auth config to
  validate a foreign password hash (argon2, scrypt, pbkdf2, a framework's format)
  on login; on the first successful login Fonderie transparently re-stores the
  password as bcrypt, so the legacy verifier runs at most once per migrated user.
  Imported bcrypt hashes need no config — the built-in check already accepts them.
  No behavior change unless `legacyVerify` is set.
- 2d4dac8: Add `app.checkProductionReadiness()` — one call that aggregates every module's
  config footguns into a structured report (`{ ok, problems[] }`) you can gate a
  deploy on or expose from a readiness endpoint, instead of relying on scattered
  boot-time warnings. Modules opt in via an optional `IFonderieModule.checkReadiness()`;
  core aggregates without importing them (`ok` is false on any `error`-severity
  problem). Auth reports a weak/placeholder `jwtSecret` (error) and
  `secureCookies: false` (warning); courier reports message types routed to a
  channel with no provider (warning). The existing auto-guards (auth fails closed
  in production, courier warns at boot) are unchanged — this adds the inspectable
  data path alongside them.

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0
  - @fonderie/events@4.0.0
  - @fonderie/rate-limit@3.0.0

## 3.0.0

### Minor Changes

- 6e9f785: Production-grade, composable email templates. Templates are now **body
  fragments** injected into a shared branded layout shell (`templates/layout.ts`)
  — a cross-client-hardened responsive frame (max-width card, hybrid inline +
  `<style>` CSS, mobile media query, Outlook VML shim) with a small retunable
  theme token set (`EMAIL_THEME`). One shell, many bodies: the DB and FS resolvers
  both compose it, so every transactional email renders the same frame for free.

  Seeds now ship the templates auth and workspaces actually send —
  `email-verification`, `password-reset`, `workspace-invitation`, `email-changed`
  (previously only `email-verification` was seeded; the rest fell through to a raw
  JSON debug fallback). Founders can override the whole shell by storing a
  `_layout` template (DB row or `_layout.html` file); a template that is already a
  full HTML document is passed through untouched (never double-wrapped).

  Localization is now wired end-to-end. `IAuthUser` carries the user's `locale`
  (sourced from the DB row via the session middleware), and every auth/workspaces
  notification emit now stamps `locale` on the courier message so per-locale
  templates are actually selected. The resolver's locale lookup was made
  region-safe: it serves the **exact** locale or the neutral `NULL` default and
  **never a sibling region** (`en-CA` will not fall back to `en-US`) — the SQL now
  uses `locale IS NOT DISTINCT FROM $2` ordering plus a `(locale = $2 OR locale IS
NULL)` filter, so legal/jurisdictional copy can't bleed across regions.
  Workspace invitations intentionally omit `locale` (the invitee's language is
  unknown at invite time) and fall to the neutral default.

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/events@3.0.0
  - @fonderie/rate-limit@2.0.0

## 2.1.0

### Minor Changes

- 41c29b0: Add `routes` to `IAuthConfig` — override the HTTP path (and optionally method) of any auth route, keyed by a stable id (`register`, `forgotPassword`, `me`, `updateProfile`, …). Lets an app match an existing frontend's contract **without a gateway or path shim** — e.g. `routes: { forgotPassword: '/auth/forgot-password', updateProfile: { method: 'PATCH', path: '/users/me' } }`. A bare string overrides the path; an object can also change the method; unset routes keep their defaults. Surfaced by the client-app rewrite: this eliminates the app-side path shim the Phase-1 re-run needed, taking adoption-under-an-existing-frontend to fully drop-in for the auth surface.

## 2.0.0

### Patch Changes

- 5c9d49b: Fix auth cookies not reaching the client. Two bugs made `access_token` / `refresh_token` cookies unusable end-to-end: (1) `@fonderie/auth` emitted both cookies joined into a single comma-separated `Set-Cookie` header (invalid HTTP — each cookie needs its own header, and the two have different Paths); (2) `@fonderie/adapter-express` forwarded response headers with `forEach` + `setHeader`, which overwrites repeated `Set-Cookie` headers so only the last survived. Auth now returns one string per cookie and sets them via a `Headers` object (`cookieHeaders`); the express adapter forwards the full list via `getSetCookie()`. Cookie names, attributes (HttpOnly, SameSite=Strict, per-cookie Path, Secure) are unchanged — they now actually arrive. Surfaced by the client-app rewrite (Phase 1), where the frontend's expected auth cookies were missing.
- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0
  - @fonderie/rate-limit@1.0.0

## 1.3.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.
- Updated dependencies [9cbb2eb]
  - @fonderie/rate-limit@0.1.1

## 1.3.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.3.0

### Minor Changes

- a121955: Security: access tokens are now revocable. Each token pair carries a `sid`
  claim bound to its server-side session row (`fonderie_sessions.sid`, new
  migration), and `withSession` rejects access tokens whose session has been
  deleted — so logout, refresh rotation, and password change kill the access
  token immediately instead of letting it live out its JWT expiry. New
  `accessTokenDuration` config (default '24h') controls the access-token
  lifetime. Legacy tokens without a `sid` (issued before this release, and
  short-lived mfaPending tokens) still authenticate and age out naturally.

## 1.2.0

### Minor Changes

- 237777a: New package **@fonderie/rate-limit** and default brute-force protection in auth.

  - `@fonderie/rate-limit`: an atomic token-bucket limiter with three
    interchangeable stores — `MemoryStore` (single instance), `StoreAdapterStore`
    (distributed over Postgres via one `INSERT … ON CONFLICT` upsert), and
    `RedisStore` (one Lua `eval`, no Redis dependency — structural client). Emits
    IETF `RateLimit-Limit`/`-Remaining`/`-Reset` + `Retry-After`. Ships a
    `migrations/` subpath for the Postgres backend.
  - `@fonderie/auth` now rate-limits login, registration, password reset, and
    MFA verification **by default**, backed by the module's own store adapter —
    distributed-correct across instances with zero configuration. Login uses
    dual limits (per-IP and per-account). Tune via the new `rateLimit` config
    field, inject a `RedisStore` for scale, or set `rateLimit: false`.
  - `@fonderie/core` + adapters: `resolveClientIp()` populates
    `ctx.meta.clientIp` with explicit proxy trust (`TRUST_PROXY`), which the
    limiter's `byIp()` keying consumes.

## 1.1.1

### Patch Changes

- Two security fixes found by measuring an AI agent's build against this module:

  - Auth cookies now carry the `Secure` attribute (default: `NODE_ENV ===
'production'`; override with the new `secureCookies` config flag). All
    login paths — email, phone, OAuth, MFA, refresh, logout — share one
    cookie serializer, so the attributes can't drift between routes again.
  - The forgot-password cooldown no longer answers `429 VERIFICATION_COOLDOWN`
    (which fired only for existing accounts, letting an attacker enumerate
    users by requesting twice). Within the cooldown the send is silently
    skipped and the response is byte-identical to the unknown-email branch.

## 1.1.0

### Minor Changes

- One request-validation layer across every endpoint-exposing package:

  - `validate(schema)` middleware in `@fonderie/core/middlewares` (structural
    `safeParse` interface — core stays dependency-free)
  - zod request schemas on all 43 body-taking routes across auth, workspaces,
    billing, customers, and webhooks; invalid input returns 422
    `INVALID_PARAMETER` with a field path before the controller runs; parsed
    bodies are trimmed and stripped of unknown keys
  - schemas exported per package (`schemas.*`) so docs generators and typed
    clients read the same contract the runtime enforces
  - provider-shaped webhooks (`/billing/webhook`, `/courier/delivery/*`) are
    deliberately exempt — gated by signature verification instead

## 1.0.1

### Patch Changes

- Packaging and DX fixes found by dogfooding a fresh AI-agent install:

  - Every `@fonderie/*/migrations` subpath now actually ships its declared
    `index.d.ts` — the two parallel tsup dts passes raced over `dist/` and the
    migrations declaration was lost on multi-entry packages. Migrations now
    build as a separate sequential pass.
  - The adapters' optional peers are now truly optional: `withWorkspace`,
    `requirePermission`, and `requireFeature` lazy-load
    `@fonderie/workspaces`/`permissions`/`billing` on first request instead of
    statically importing them at module load, with a targeted install error
    when the peer is genuinely missing.
  - `OPERATIONS` and the `Operation` type moved to `@fonderie/core`;
    `@fonderie/permissions` and the adapters re-export them unchanged.

- Updated dependencies
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
