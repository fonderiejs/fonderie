# @fonderie/config

## 6.6.9

### Patch Changes

- e73bef2: Race fixes in admin, config and customers.
  
  **@fonderie/admin.** Two requests confirming the same enrollment with a valid code both signed in, and the second replaced the backup codes the first had just shown. Now exactly one confirms: the operator row is locked and the promotion only happens while the enrollment is still unconfirmed. A burst of wrong enrollment codes also all got through the lockout check before the first failure was counted. Now they are checked one at a time, so at most five are tried, as at sign-in. Two recovery links issued at the same moment both stayed live. Now issuing a link retires the earlier ones and inserts the new one in a single serialized transaction.
  
  **@fonderie/config.** Two first writes of one key with different kinds (on/off and text, say) both saved, so the second silently changed the key's type. The kind check now runs under the key's write lock. A secret written during `rotateSecretKey()` could end up encrypted with the old key: either written over the re-encrypted value after the rotation committed, or as a new key or revision the rotation never saw. Either way, nobody could read it once the old key was gone. Secret writes and rollbacks now share a lock with the rotation and encrypt inside it. The rotation also records a key check, so an instance still running with the old key gets a clear error instead of storing unreadable values. **Run migrations before rotating:** migration `004_secret_key_check` adds the table, and it only adds.
  
  **@fonderie/customers.** Some customers could be created or updated with codes another customer already held:
  
  - A referral code the caller chose that another customer holds was a 500. Now it is a 409 `DUPLICATE_REFERRAL_CODE`.
  - A reference code the caller chose that another customer holds was a 500 on update. Now it is a 409 `DUPLICATE_REFERENCE_CODE`, as it already was on create.
  - The reference-code counter could hand out a code someone had typed in by hand. That gave a 409 on create for a code the caller never sent, and a 500 on update. The counter now skips codes that are taken.
  - A generated code lost to a concurrent create is generated again instead of failing.
  
  **@fonderie/client.** Added the `DUPLICATE_REFERRAL_CODE` error message in every UI language.

## 6.6.8

### Patch Changes

- Updated dependencies [ae2dcc6]
  - @fonderie/core@0.32.0

## 6.6.7

### Patch Changes

- Updated dependencies [4aca9ac]
  - @fonderie/core@0.31.0

## 6.6.6

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0

## 6.6.5

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0

## 6.6.4

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 6.6.3

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 6.6.2

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 6.6.1

### Patch Changes

- dfe12db: `GET /config/public` now reads fresh on every request, so a client that re-reads because it was told config changed gets the new value.
  
  **The bug:** the route served each instance's in-memory snapshot, which is refreshed by a TTL timer (30s default) and by LISTEN. On serverless, neither is reliable: instances are frozen between requests, and a transaction pooler accepts LISTEN but never delivers the notifications. So an operator switched a screen off, the app was told at once and re-read, and an instance served the old value. No further event came, so the app kept showing the old value until its next reconnect.
  
  **The fix:** the route awaits the new `RemoteConfigManager.reload()` before answering. That's one small query, and concurrent requests share it. A failed read keeps the previous snapshot. Server-side `getConfig(ctx, …)` still reads the snapshot and is unchanged.

## 6.6.0

### Minor Changes

- e10f440: The event catalog, step 2 of `docs/REALTIME-DESIGN.md`: each brick declares which of its events a client may receive.
  
  **`@fonderie/core`:**
  - New optional module method `describeEvents()`, beside `describeAdmin()`, returning `IEventCatalogEntry[]`. Each entry has a type, a description, and an audience: `'public'`, `'workspace'`, `'user'`, or a function for the app's own rule. It can also give a `scope(payload)`, which is required for the workspace and user audiences, and a `project(payload)` listing the client-safe fields (ids only). It can name a Postgres NOTIFY `source`.
  - `app.eventCatalog()` merges and validates every module's entries. It throws on an invalid entry, or on one type declared by two modules. The default is deny: an event with no entry is never delivered to a client.
  - `matchesTopic` / `isValidTopicFilter` for client topic filters: `*`, an exact type, or a `prefix.*` segment prefix. They are matched literally, never as a regex.
  
  **`@fonderie/events` (R4):** `matchesPattern` escaped only `.`, so any other regex metacharacter in a pattern was live regex, and `a+b` matched `aab`. Every character except `*` is now literal. The wildcard semantics are unchanged.
  
  **`@fonderie/config`:**
  - Declares `fonderie.config.changed`, public and sourced from its existing NOTIFY. It carries the environment only, never keys or values.
  - **R3:** deleting a config entry now sends the same NOTIFY as a write, inside the transaction and only when a row was deleted. Before, other instances learned of a delete only on their next poll.
  
  **`@fonderie/customers`:** declares its five events for the workspace audience. They carry only `customerId` and `workspaceId`, never personal data.

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 6.5.3

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 6.5.2

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

## 6.5.1

### Patch Changes

- 8dd41f4: Docs: the config README names the encryption key `CONFIG_SECRET_KEY` (it said `SECRET_KEY`, which no deployment uses) and no longer claims the encryptor can be created from an unset key — `createAesGcmEncryptor` throws on that. The admin README documents the environment report at `GET /_admin/environment` (it named `/_admin/config`, which belongs to @fonderie/config) and no longer states that bricks never read `process.env`.

## 6.5.0

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

## 6.4.1

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 6.4.0

### Minor Changes

- 97c7619: Config values without a type picker — and without silent type changes.
  
  - **Admin (React + Vue):** creating an entry no longer asks for a type. One
    field takes text, a number, true/false, or JSON for an object or a list of
    objects; the detected shape is shown as you type, and only genuinely
    ambiguous input ("true", "42") offers "Save as text instead". Anything that
    merely looks like a number — `1.10`, `0123`, `1e3`, a long ID — stays text
    rather than being rewritten. Editing locks the type to what is stored; a
    deliberate "Change type…" is the only way to change it. The environment line
    is now labelled.
  - **config:** every value is stored JSON-encoded, text included. Text used to
    be stored raw and parsed back with a raw fallback, so a text value that
    looked like JSON came back as a different type ("42" → number). Rows written
    the old way still read correctly.
  - **config:** saving a different value kind over an existing key (on/off →
    text, list → object) is refused with `409 CONFIG_TYPE_CHANGE` unless the
    request sends `allowTypeChange: true`. Frontends read flags with a typed
    fallback, so a silent change would read as a different setting — this holds
    for the API, the CLI and the UI alike. `configValueKind()` and
    `ConfigTypeChangeError` are exported.
  - **client:** `inferConfigValue()` and `configValueLabel()`;
    `ISetConfigInput.allowTypeChange`.
  - **cli:** `config set` uses the same inference (it used plain `JSON.parse`,
    which turned "1.10" into 1.1); `--text` and `--allow-type-change` flags.

## 6.3.0

### Minor Changes

- c742537: Remote config for frontends: switch a feature on in the admin, and screens
  follow without a deploy.
  
  - **config:** `publicKeys` option — the keys a frontend may read, as a list or
    a record of key → default. Served by a new unauthenticated
    `GET /config/public` from the in-memory snapshot, `Cache-Control: no-store`.
    Nothing is exposed unless listed; secrets are never readable there.
  - **client:** `client.config` — `load()` fills one shared snapshot per
    FonderieClient (concurrent calls share a request; a failed refresh keeps the
    previous values), `get(key, fallback)`, `snapshot()`, `subscribe()`.
  - **react** (works in React Native too) and **vue:** `useRemoteConfig()` and
    `useFlag(key, fallback)` — loaded on first use, shared across components,
    optional `refreshMs`. Pass the SAFE fallback: it renders before the first
    load and when loading fails.

## 6.2.2

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 6.2.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.

## 6.2.0

### Minor Changes

- 21590b0: `rotateSecretKey(store, from, to)` — re-encrypt every stored secret onto a new key.
  
  Until now `CONFIG_SECRET_KEY` was permanent. Stored values are AES-GCM
  ciphertext under it, so changing the key made every secret undecryptable and
  losing it made them unrecoverable — a one-way door on a routine operational task
  (a leaked key, someone leaving, an annual rotation policy).
  
  **Revisions are re-encrypted too, and that is the point.**
  `fonderie_secret_revisions.value` holds ciphertext as well. A rotation touching
  only `fonderie_secrets` would appear to work — every reveal would succeed — and
  would quietly destroy every rollback target, surfacing much later as
  `rollbackSecret()` restoring a value encrypted under a key nobody still has.
  
  Failure behaviour, because a half-rotated table is unrecoverable once the old
  key is gone:
  
  - one transaction, with `FOR UPDATE` on both tables so a concurrent `setSecret()`
    cannot write under the old key mid-rotation
  - every value is decrypted and re-encrypted **in memory before anything is
    written**, so a wrong `from` key aborts having changed nothing
  - the error names the offending row rather than surfacing a bare
    "unable to authenticate data"
  - not idempotent by design: a second run with the same pair refuses, rather than
    double-encrypting
  
  Deliberately a library call, not an admin route — rotating needs the *new* key,
  and putting a fresh master key in a request body sends it through every log and
  proxy in front of the surface.
  
  ```ts
  await rotateSecretKey(
    store,
    createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY_OLD!),
    createAesGcmEncryptor(process.env.CONFIG_SECRET_KEY!),
  ); // → { secrets: 12, revisions: 47 }
  ```

## 6.1.0

### Minor Changes

- 8e89e7e: One shutdown convention: `IFonderieModule.stop?()` and `FonderieApp.shutdown()`.
  
  A module could acquire an interval, a pool, a LISTEN client or a listening
  socket, and the framework offered no way to release any of it. Each brick that
  cared invented its own name — `@fonderie/webhooks` had already grown a private
  `stop()` with the comment *"without this the interval keeps the process alive
  after shutdown"*, and nothing called it. `@fonderie/config` hid its cleanup
  behind `.manager.stop()`, which an app had to know to reach inside for.
  
  The cost is not theoretical: a process held open by a resource nobody released
  exits never, with no error and no output. That is what hung this repo's CI for
  six release cycles.
  
  - `IFonderieModule.stop?(): void | Promise<void>` — optional, so no existing
    module changes. Must be idempotent.
  - `FonderieApp.shutdown()` — calls them in **reverse install order**, so a
    module's dependencies are still alive while it shuts down. Every module is
    attempted even if one throws; failures are collected and thrown together, so
    one brick failing cannot strand the rest holding sockets, and a partial
    shutdown is still reported rather than swallowed.
  - `ConfigModule.stop()` clears the TTL refresh interval and the LISTEN client.
  - `EventsModule.stop()` releases the transport's pool, LISTEN client and poll
    loop.
  
  Existing apps are unaffected until they call `shutdown()`. Serverless hosts
  that never shut down cleanly lose nothing; anything with a SIGTERM path gains a
  single call that releases everything.

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 6.0.0

### Major Changes

- 3a73832: **Breaking:** without a `secretEncryptor`, the secrets admin surface now refuses
  every request instead of handling plaintext.
  
  `ConfigModule` substituted `noopEncryptor` when none was configured, so a
  deployment with no key stored secrets in clear **and handed them back** over
  `POST /admin/secrets/:key/reveal`.
  
  `checkReadiness` was supposed to catch that, and could not. It escalated to a
  production error only when this module had its **own** `adminToken`, reasoning
  that otherwise "the surface isn't registered at all". That reasoning was wrong:
  `describeAdmin()` is unconditional, so `@fonderie/admin` mounts these routes
  under `/_admin` and reveals secrets regardless of this module's token. The
  normal deployment shape — config brick with no token of its own, admin console
  hosting it — was exactly the one the check waved through as a warning.
  
  The check cannot detect an admin host: `enforceProductionReadiness()` runs
  before any `install()`, and `describeAdmin()` is called from the admin module's
  install. So this fixes the exposure rather than the label.
  
  Now, with no encryptor:
  
  - every `/secrets*` route returns `503 SECRETS_DISABLED`, naming the cause and
    the fix
  - config entries are unaffected — they carry no secret material
  - `checkReadiness` still reports the absence, as a warning that says what
    actually happens
  
  The routes are still **described**, deliberately. Omitting them would hide the
  console's page, and an operator who sees nothing learns nothing; a refusal that
  names itself is a signal they can act on.
  
  To keep the previous behaviour, pass `secretEncryptor: createAesGcmEncryptor(key)`
  (`openssl rand -hex 32`). Passing `noopEncryptor` explicitly still works and
  still stores plaintext — it is now a choice rather than a default.

## 5.2.4

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

## 5.2.3

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 5.2.2

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 5.2.1

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 5.2.0

### Minor Changes

- e687c4e: Describe the admin routes for `@fonderie/admin`; legacy `/admin/*` paths deprecated
  
  `describeAdmin()` offers the same handlers as the standalone `/admin/*`
  surface — unguarded and prefix-relative — for `@fonderie/admin` to mount
  under its prefix behind its own token. One route table backs both, so they
  cannot drift.
  
  The standalone `/admin/*` routes, guarded by this module's `adminToken`,
  keep working unchanged and are **deprecated**: they go in a later major, once
  the composed surface is the norm. `docs/ADMIN-BRICK-DESIGN.md` phase 3.

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 5.1.15

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 5.1.14

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 5.1.13

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 5.1.12

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 5.1.11

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 5.1.10

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 5.1.9

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 5.1.8

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 5.1.7

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 5.1.6

### Patch Changes

- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 5.1.5

### Patch Changes

- cd2706a: Flag lookups no longer fail open through the prototype. `get(key, fallback)` resolved plain-object lookups, so keys like `constructor`/`toString` returned inherited Object.prototype members — truthy functions — and a feature gate keyed on attacker-influenced input failed OPEN. Lookups now require an own property, and the entries snapshot is built with a null prototype so a DB row keyed `__proto__` cannot pollute it.
- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 5.1.4

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.1.3

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.1.2

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.1.1

### Patch Changes

- 0f0ca59: Unify admin-route authentication into one shared primitive (see docs/ADMIN-AUTH-SPEC.md).
  
  Every module with an ops/admin surface (billing plan-writes + wallet-grant, config/secrets admin, courier template admin) previously shipped its own hand-rolled Bearer guard — three byte-identical copies of `safeTokenEqual` + the guard, with no guarantee they stayed in sync.
  
  - **`@fonderie/core`** now exports `requireAdminToken(adminToken)` and `validateAdminToken(token, { module })` from `@fonderie/core/middlewares` — the one constant-time Bearer guard and the one admin-token strength rule (min 32 chars, reject placeholders). Core depends on nothing, so there is no cycle.
  - **`@fonderie/billing`** and **`@fonderie/courier`** delete their local guard copies and adopt the shared one, and — the real fix — now call `validateAdminToken` in `checkReadiness()`, so a weak/placeholder admin token guarding `/plans` + `/billing/wallet/grant` or `/admin/templates` is a **production readiness error** (previously only `@fonderie/config` enforced this; billing/courier accepted a `changeme` token).
  - **`@fonderie/config`** drops its duplicate guard + strength logic for the shared core versions — behavior-identical, no observable change.
  
  No route paths, methods, request/response shapes, or config fields change. `requireAdminToken` behavior (Bearer, constant-time, `401 UNAUTHORIZED / "Missing or invalid admin token"`) is preserved exactly.
- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.1.0

### Minor Changes

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

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0

## 4.0.0

### Minor Changes

- 5a0d76e: Config control-plane, phase 4 — the safe admin HTTP surface. `ConfigModule`
  registers `/admin/config/*` and `/admin/secrets/*` routes **only when an
  `adminToken` is configured** (fail-closed — no token, no exposed admin surface),
  each guarded by a `Bearer` token. Endpoints: list / get / put (with `ifVersion`
  optimistic concurrency → **409** on a lost compare-and-swap) / delete /
  `GET :key/revisions` / `POST :key/rollback`, for both config and secrets. Secret
  reads stay masked; `POST /admin/secrets/:key/reveal` is the single decrypt path.
  Writes record an actor (optional `X-Actor` header). A `secretEncryptor` option
  wires at-rest encryption. Exports `buildAdminRoutes`.
- 3dd9c36: Config control-plane, phase 2 — push propagation. A config write now emits
  `pg_notify('fonderie_config_changed', env)` on commit, and `RemoteConfigManager`
  gains an optional `connectionUrl`: when set, it opens a dedicated `LISTEN` client
  and refreshes its snapshot within **milliseconds** of any write (replacing the
  30s poll latency; the `ttl` poll becomes a slow safety floor). Unset =
  poll-only, unchanged. `pg` is a peer dependency (matching `@fonderie/events`).
  Proven end-to-end against real Postgres: a write on one connection propagates to
  a separate manager's snapshot in ~400ms while a poll-only control stays stale.
- 71a27f8: Config control-plane, phase 3 — the **secret** kind (ConfigMap vs Secret). A
  separate `fonderie_secrets` table + read path sharing config's exact lifecycle
  (version index, optimistic concurrency, advisory-locked writes, revisions,
  rollback, push-notify) but with secret-grade exposure: admin `getSecret` /
  `listSecrets` return **metadata only — never the value** (masked), and the value
  is **encrypted at rest** via a pluggable `ISecretEncryptor` (`noopEncryptor`
  default; `createAesGcmEncryptor(keyHex)` for real AES-256-GCM). `revealSecret` is
  the single decrypt path. `pg_notify` payloads carry the environment only, never
  the value. Exports: `setSecret`/`getSecret`/`revealSecret`/`listSecrets`/
  `rollbackSecret`/`listSecretRevisions`/`deleteSecret`, `ISecretEntry`/
  `ISecretRevision`, `ISecretEncryptor`/`noopEncryptor`/`createAesGcmEncryptor`.
- e8c5e96: Config control-plane, phase 1 — version index, revisions, rollback, optimistic
  concurrency. Each write bumps a monotonic `version` and appends an immutable
  revision (`fonderie_config_revisions`); `updated_by` records the actor.
  `setConfigEntry` takes an optional `ifVersion` (compare-and-swap — commits only
  if the version matches, else throws `ConfigConflictError`; reject-and-retry) and
  `actor`. New `rollbackConfigEntry` rolls _forward_ to a past value (k8s `rollout
undo`), and `listConfigRevisions` returns the history. Concurrency is safe: an
  advisory xact lock keyed on `(key, environment)` serializes writers even for a
  key that doesn't exist yet (closing the create-race the row lock can't cover).
  Existing `setConfigEntry` callers are unaffected (the new fields are optional).

### Patch Changes

- d549e46: Test coverage + docs pass over the control plane: unit tests for the previously
  proof-only paths (rollback config/secret, config/secret revisions, secret reveal,
  delete secret), and a rewritten README documenting versioning, optimistic
  concurrency, rollback, secrets (masked/encryptable), the admin HTTP surface, the
  CLI, and push propagation. Dependencies confirmed minimal (zero runtime deps;
  peers core/store/pg only).
- ce666fb: Config control-plane, phase 6 (generalize) — lift the version index / optimistic
  concurrency / advisory-locked write / append-only revisions / rollback /
  push-notify machinery into a shared `versionedWrite` + `versionedRollback`
  primitive (`services/versioned.ts`) that both `config` and `secrets` now run on.
  Removes the ~1:1 duplication between the two services and makes a new versioned
  admin resource a table descriptor + its read shape away. Pure internal refactor
  — no public API or behavior change (`ConfigConflictError` is re-exported from the
  same path); all 29 tests green + re-proven end-to-end against real Postgres for
  both resources (OCC, revisions, rollback, secret encrypt/mask/reveal, and the
  resource-specific `fonderie_config_changed` / `fonderie_secrets_changed`
  channels).
- da7e79c: Lift the versioned-resource control-plane primitive into `@fonderie/store` so any
  package can reuse it (no `config` dependency). `versionedWrite` /
  `versionedRollback` / `VersionConflictError` are now exported from store,
  generalized: a resource declares its `(primary, scope)` key columns (null-safe —
  a NULL scope is the base), its revisioned `contentColumns` (one or many), and
  optional main-table `metaColumns`. This serves config's `(key, environment,
value)` and courier's `(type, locale, subject/html/text)` shapes alike.
  `@fonderie/config` re-points onto it; `ConfigConflictError` is now an alias of
  `VersionConflictError` (same exported name, `instanceof` unchanged). Behavior
  preserved — config 36/36 + store tests green, and both shapes proven end-to-end
  against real Postgres (incl. NULL scope + multi-column rollback).
- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0

## 1.0.3

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.0.2

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

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
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/core@0.1.0
  - @fonderie/store@0.1.0
