# @fonderie/webhooks

## 7.2.3

### Patch Changes

- Updated dependencies [0423614]
  - @fonderie/workspaces@8.0.0

## 7.2.2

### Patch Changes

- Updated dependencies [8ac8a40]
  - @fonderie/core@0.33.0

## 7.2.1

### Patch Changes

- fd8d557: **events:** a handler that ran longer than `claimTimeoutMs` no longer overwrites the outcome of the consumer that took its row over. Its row was reclaimed, and when the slow handler finally returned it wrote on top of the newer result: a late failure turned a processed row back into `failed` (so the work ran again), and a late success revived a row already buried as dead. Every claim now carries a claim token (additive migration `006_event_consumers_claim_token.sql`), outcomes are written only while the row is still `processing` under that token, and a lost claim is logged with a hint to raise `claimTimeoutMs`.
  
  **webhooks:** an event is delivered to an endpoint once, and a delivery is never silently lost.
  
  - A re-dispatched event (the outbox re-runs a dispatch that did not finish) no longer inserts a second delivery row and POSTs the same event to the customer's endpoint again. Migration `003_delivery_once.sql` removes existing duplicates — keeping the delivered row, else the one with the most attempts, else the oldest — and adds a unique `(endpoint_id, event_id)`; the insert is `ON CONFLICT DO NOTHING`.
  - A delivery whose process died between recording it and its first attempt is now retried. It stayed `pending` forever, because the retry loop only claimed `failed` rows; `pending` rows older than the retry lease are claimed too.
  - A delivery row that cannot be written now fails the dispatch, so the outbox retries the event. The failure used to be swallowed, the event was marked processed, and that webhook was gone with nothing left to retry it.

## 7.2.0

### Minor Changes

- b1bb38f: The owner hears when someone else adds a webhook or cancels the plan, and the audit trail can be limited to the people allowed to read it (docs/INSIDER-THREAT-DESIGN.md, Phase 6).
  
  Adding a webhook (a live copy of every event of the business) or cancelling the plan happened outside the team brick. Nothing recorded who did it, and the owner was not told. Any member could read the whole audit trail, including who removed whom.
  
  - **`@fonderie/webhooks`:** after a successful change, emits `fonderie.webhook.endpoint.created`, `.updated`, `.deleted` or `.restored` with `{ workspaceId, userId, endpointId, host }`. Only the URL's host is recorded, never its path or query (which may carry a token), and never the secret. Exported as `WEBHOOK_EVENTS`.
  - **`@fonderie/billing`:** after a successful cancel, emits `fonderie.billing.subscription.cancel_requested` with `{ workspaceId?, subscriberType, subscriberId, userId, atPeriodEnd }`.
  - **`@fonderie/workspaces`:** emails the owner when someone else creates a webhook (`workspace-webhook-created-alert`, naming the host) or cancels a team's plan (`workspace-plan-cancel-alert`, saying whether it ends now or at period end), in 5 languages. The owner's own moves and personal plans send nothing. `OWNER_ALERT_EVENTS` lists the events it listens to.
  - **`@fonderie/audit`:** `new AuditModule(store, { permission: 'audit' })` makes reading the trail require `read` on that permission through `@fonderie/permissions`. It refuses when that module is missing. Unset, nothing changes.

## 7.1.0

### Minor Changes

- 09835c4: Someone deleting too much too fast is paused from deleting until the owner looks (docs/INSIDER-THREAT-DESIGN.md, Phase 5).
  
  A rogue manager, or a script running with their session, could remove the team, delete every role, customer and webhook in a few seconds. The undo bin brings things back, but only after someone notices.
  
  - **What counts:** every successful destructive action by someone who is not the owner is counted: removing a member, deleting a role, cancelling an invitation, deleting a customer or a webhook endpoint.
  - **The pause:** at `limit` in `windowMinutes` (default 10 in 10), that person is paused. Every braked route answers `429 MANAGER_PAUSED`. Reading and ordinary work go on; the owner is never braked.
  - **Telling the owner:** a pause is recorded as `fonderie.workspace.manager.paused` in the audit trail, and the owner is emailed (`workspace-manager-paused`, in 5 languages).
  - **Seeing and releasing:** members carry `paused`. The owner releases with `DELETE /workspaces/members/:userId/brake` (`client.workspaces.releaseBrake`, `useMembers().releaseBrake`), and the count starts over.
  - **For other modules:** `velocityBrake(store, kind, options, bus)` is exported for their own destructive routes. Configure it with `velocityBrake: { limit, windowMinutes }`, or turn it off with `false`, in workspaces, customers and webhooks.
  - **Migration:** apply workspaces `008_velocity_brake`. Customers and webhooks brake their deletes as soon as `@fonderie/workspaces` 7.1 is installed.

## 7.0.0

### Major Changes

- ae2dcc6: Big moves now ask the person to prove it's still them, and handing a team over waits for the new owner (docs/INSIDER-THREAT-DESIGN.md, Phase 4).
  
  A stolen session, or a colleague's unlocked phone, could give a team away, end its plan at once, or add a webhook that streams every event of the business to someone else's server. Each took one request.
  
  **Step-up** (`@fonderie/auth`):
  - `GET /auth/step-up` lists the proofs this account can give.
  - `POST /auth/step-up/code` sends a code to the account's email or phone.
  - `POST /auth/step-up` checks the proof and returns a 5-minute token. The client sends it back as `X-Step-Up`.
  - With two-factor on, only the authenticator is accepted; a password alone is what a thief may have. Otherwise the password, or a code that was sent.
  - `AuthModule` puts a verifier on every request, so other modules ask it without importing auth.
  - The client (`auth.stepUp`, `isStepUpRequired`) holds the proof and sends it automatically. `useStepUp` is in React, React Native and Vue.
  - `X-Step-Up` joins core's default CORS headers.
  - Apply auth migration `025_step_up_codes`.
  
  **Breaking:** without a fresh proof, these now answer `403 STEP_UP_REQUIRED`. Prove it, then retry.
  - `@fonderie/workspaces`: `POST /workspaces/transfer-ownership`.
  - `@fonderie/billing`: `POST /billing/subscription/cancel` with `atPeriodEnd: false`. Cancelling at period end, the default, is unchanged.
  - `@fonderie/webhooks`: `POST /webhooks`, and `PATCH /webhooks/:id` when it changes the URL.
  - Each module takes `stepUp: false` to turn this off. They need `@fonderie/auth` 7.27 or later registered; without its verifier they refuse rather than wave the move through.
  
  **Breaking — ownership is offered, not moved** (`@fonderie/workspaces`):
  - `POST /workspaces/transfer-ownership` now answers `202 OWNERSHIP_OFFERED`. Nothing moves until the member accepts.
  - New routes:
    - `GET /workspaces/transfer-ownership` returns the open offer.
    - `POST /workspaces/transfer-ownership/accept` and `/decline` are for the member it is offered to.
    - `DELETE /workspaces/transfer-ownership` withdraws it (owner only).
  - An offer lapses after 7 days, and a new one replaces it. Accepting claims the offer and moves ownership in one transaction.
  - New trail events: `ownership.offered`, `.declined` and `.withdrawn`. On `ownership.transferred` the actor is now the new owner, and `targetUserId` the previous one.
  - Message keys: `workspace-ownership-offered` goes to the member, and `workspace-ownership-accepted` to the previous owner. They replace `workspace-ownership-received`.
  - Client: `getOwnershipOffer`, `acceptOwnership`, `declineOwnership` and `withdrawOwnershipOffer`, and the `useOwnershipOffer` hook.
  - Apply workspaces migration `007_ownership_offers`.

### Patch Changes

- Updated dependencies [ae2dcc6]
  - @fonderie/core@0.32.0
  - @fonderie/workspaces@7.0.0

## 6.2.0

### Minor Changes

- a299875: Deleting a customer, a custom role or a webhook endpoint can be undone for 30 days (docs/INSIDER-THREAT-DESIGN.md, Phase 3).
  
  A rogue manager, or a slip of the finger, could permanently delete customers with every email, phone, address and note, custom roles with their permissions and assignments, and webhook endpoints with their secrets. Nothing could bring them back.
  
  Now each delete first writes a snapshot of the record and everything attached to it into the module's bin, in the same transaction. A delete that is refused (a customer still on a job) leaves no snapshot.
  
  - **Restore** brings the record back with its original id, in one transaction:
    - `POST /customers/bin/:id/restore`: emails, phones, addresses, notes, tags and relationships come back too.
    - `POST /workspaces/roles/bin/:id/restore`: the role's permissions come back, and former holders still in the team get it again. Anyone moved to the default role by the delete leaves that role.
    - `POST /webhooks/bin/:id/restore`: the same URL, events and signing secret.
  - **What changed since is respected.** A deleted label is dropped from an email or phone; a referrer or related customer that is gone is left out. A taken reference code or role name answers `409 RESTORE_CONFLICT` and the snapshot stays in the bin.
  - **List** with `GET …/bin`. The webhooks bin never shows the secret.
  - **Empty one early** with `DELETE …/bin/:id`, which only the workspace owner can do. A manager who could empty the bin could delete and then erase the undo.
  - **Expiry.** Call `emptyCustomerBin`, `emptyRoleBin` and `emptyEndpointBin` from your cron to drop snapshots past the 30 days.
  - **Client and hooks.** `listDeleted*`, `restore*` and `purgeDeleted*` on the client; `useDeletedCustomers`, `useDeletedRoles` and `useDeletedWebhookEndpoints` in React (and React Native) and Vue.
  
  Apply the migrations before deploying: customers `016_customer_bin`, workspaces `006_role_bin`, webhooks `002_endpoint_bin`.

## 6.1.0

### Minor Changes

- 5eab35d: Account deletion now reaches the logs. Each of these bricks ships an `accountEraser(store)` for the account purge to run before the user row goes, so a deleted person's email, phone and name stop living on in places nothing else cleaned up.
  
  - **courier**: message-log rows sent to the person's email (any case, any `+tag`) or phone keep their delivery statistics, but the recipient — and any error or bounce text, which often quotes the address — becomes `'erased'`.
  - **events**: notifications addressed to the person are deleted (they hold one-time codes and reset links), including those sent to addresses the account had before, but only for the time each was theirs, because a freed address may now belong to someone else. Every other event that names them is redacted with the opaque user id kept, so the security trail survives, and re-signed with `integrityKey` so the integrity check still reads it as intact. Before re-signing, the eraser checks the row's current signature, so erasure can never hide tampering. It refuses, and the purge retries, while a notification to the person is still being delivered.
  - **webhooks**: delivery payloads and echoed response bodies that name the person are redacted; the delivery record itself is kept.
  
  Each eraser is idempotent and reports how many rows it touched and what it deliberately kept.

## 6.0.8

### Patch Changes

- Updated dependencies [4aca9ac]
  - @fonderie/core@0.31.0

## 6.0.7

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0

## 6.0.6

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0

## 6.0.5

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 6.0.4

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 6.0.3

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 6.0.2

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 6.0.1

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 6.0.0

### Major Changes

- 24d9fe2: The `/webhooks` routes now resolve the caller's workspace and require a manager.
  
  **The routes worked for nobody.** No route mounted `withWorkspace`, so `ctx.workspace` was always `null` and every route answered `422 MISSING_WORKSPACE`, even with an `X-Workspace-ID` header. The only exception was an app that mounted `withWorkspace` globally itself. Every route now resolves the workspace from `X-Workspace-ID` (falling back to the personal workspace) and verifies membership.
  
  **Any member could manage endpoints.** Once the workspace resolved, the routes checked no role, so any member could create, change or delete an endpoint and read the signing secret returned on create. They now require the workspace owner or a manager role, with the same `management` and `managerRoles` options as `@fonderie/workspaces`. Plain members get `403 MANAGER_REQUIRED`. Pass `{ management: 'any-member' }` to keep open access for flat teams.
  
  **Breaking:**
  - `@fonderie/workspaces` (`^6.1.0`) is now a required peer; the module already listed it in `deps`.
  - Apps that mounted `withWorkspace` themselves and let members manage webhooks must opt in with `management: 'any-member'` to keep that behaviour.

## 5.4.17

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

## 5.4.16

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0

## 5.4.15

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 5.4.14

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 5.4.13

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.

## 5.4.12

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

## 5.4.11

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

## 5.4.10

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 5.4.9

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0

## 5.4.8

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 5.4.7

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 5.4.6

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0

## 5.4.5

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0

## 5.4.4

### Patch Changes

- 0bbd63c: Move to undici 8
  
  Two majors on the library the SSRF guard depends on, so the pinning contract was
  verified directly rather than inferred from a green suite: `pinnedTransport`
  builds an undici `Agent` whose `connect.lookup` forces the socket to a
  pre-validated IP, closing the DNS-rebinding TOCTOU. If undici 8 stopped calling
  that hook, or changed its callback shape, the socket would follow live DNS again
  and the hole would reopen silently — with every existing test still passing,
  because the only `pinnedTransport` test asserts an internal address is REJECTED,
  which returns before undici is ever reached.
  
  Probed 6.28.1 and 8.10.2 side by side against a local server, requesting a
  hostname that does not resolve: both call `lookup`, both pass `all: true`, and
  both deliver the socket to the pinned address. The contract is unchanged.

## 5.4.3

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0

## 5.4.2

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0

## 5.4.1

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0

## 5.4.0

### Minor Changes

- 2042ae0: Retries no longer deliver the same webhook twice, and can now be driven where timers cannot run.
  
  `claimForRetry` was a plain `SELECT` — it claimed nothing. Every concurrent caller read the same due rows and delivered them all. One long-running server with one timer never noticed; more than one of anything — several warm serverless instances, or a container plus a scheduled ping — sent the customer's endpoint the same webhook repeatedly. Webhooks are outward-facing, so that duplicate is someone else's system acting on the same event twice.
  
  It now claims exclusively (`FOR UPDATE ... SKIP LOCKED`) and leases the row by pushing `next_attempt_at` forward, which doubles as crash recovery: `markResult` overwrites it with the real backoff, and a process that dies mid-attempt simply leaves the row to become due again. Verified against a live database — two concurrent passes over one due row claimed it twice before the fix and exactly once after.
  
  `WebhooksModule.retry()` is now public. Retries were driven solely by `setInterval`, which never reliably fires on serverless because the instance is frozen between requests — and nothing exposed a manual pass, so those deployments had no recourse at all and a failed delivery was simply never retried. A scheduled ping can call this; it is safe alongside the timer, since claims are exclusive.
  
  `WebhooksModule.stop()` clears the retry interval, which was created and never cleared.

## 5.3.5

### Patch Changes

- Updated dependencies [c63f35b]
  - @fonderie/core@0.14.0

## 5.3.4

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0

## 5.3.3

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0

## 5.3.2

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0

## 5.3.1

### Patch Changes

- 620b4fa: Fix a CRITICAL SSRF blocklist bypass: an internal IPv4 embedded in IPv6 was only blocked in the dotted mapped form (`::ffff:1.2.3.4`). The hex-colon mapped form (`::ffff:a9fe:a9fe` = 169.254.169.254 cloud metadata), fully-expanded mapped, NAT64 (`64:ff9b::/96`), 6to4 (`2002::/16`), and deprecated IPv4-compatible (`::/96`) embeddings all passed the check — a workspace member could register a webhook at one of these, have the server proxy to cloud metadata / loopback / RFC1918, and read the response back from the delivery log. `isBlockedAddress` now canonicalizes the address (full 8-group expansion, dotted-tail handling) and extracts the embedded IPv4 from every wrapping notation before applying the IPv4 blocklist; public IPv4-in-IPv6 (e.g. `::ffff:8.8.8.8`) stays allowed. Registration and the DNS-pinned delivery path share this logic, so both are covered.

## 5.3.0

### Minor Changes

- b093e3e: Close the webhook SSRF DNS-rebinding TOCTOU by pinning the delivery connection to the validated IP. The guard resolved + validated the endpoint's addresses, but the subsequent `fetch` re-resolved the name — a hostile host could rebind to an internal address in that window. Delivery and test-send now go through `pinnedTransport`: it resolves + validates the URL, then connects via an `undici` Agent whose connector always returns the pre-validated IP, so the socket can only reach the address that passed the check. TLS SNI / certificate validation still use the URL hostname, so HTTPS endpoints work normally; redirects are never followed and the response body is capped (4 KiB). Adds `undici` as a dependency and exports `resolvePinnedTarget`, `pinnedTransport`, `readCappedText`, and the `WebhookTransport`/`IWebhookResponse`/`IPinnedTarget` types. Verified live: an HTTPS POST completes over a pinned connection with hostname cert validation, while a cloud-metadata IP is refused before any connect.

## 5.2.3

### Patch Changes

- be7a6e7: Cap stored delivery response bodies at 4 KiB. The receiving endpoint is caller-controlled and its response was buffered (`res.text()`) and persisted in full on every delivery and retry — unbounded memory use and `fonderie_webhook_deliveries` growth. The body is now read via a capped stream and truncated before storage; the field is diagnostic, so 4 KiB is ample.
- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0

## 5.2.2

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0

## 5.2.1

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.2.0

### Minor Changes

- fc6b4c4: Guard outbound webhook delivery against SSRF. Webhook URLs are attacker-controlled, so both endpoint registration and every delivery now reject non-`http(s)` schemes and any host that resolves to a non-public address (loopback, RFC1918, CGNAT, link-local incl. the cloud metadata IP `169.254.169.254`, IPv6 ULA/link-local, and reserved ranges). The check runs again at delivery time — not just registration — because DNS can change, and deliveries are sent with `redirect: 'manual'` so a public host cannot 302 the request into an internal one. Adds `assertPublicHttpUrl`, `isBlockedAddress`, and `SsrfError` to the public API for pre-validation.

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

### Patch Changes

- d32b21c: Audit pagination reaches past the max page, and webhook retries actually retry
  
  Two silent runtime failures. In @fonderie/audit, the route over-fetched
  `limit + 1` rows to detect a next page while the model re-clamped to
  MAX_LIMIT — at the maximum page size the two caps cancelled, `nextCursor`
  could never be set, and pagination silently ended at the boundary. The +1
  over-fetch now lives inside the model (which returns `{ events, hasMore }`),
  so no outer clamp can shave it off. The keyset cursor also now carries
  `created_at::text` at full microsecond precision instead of a
  millisecond-truncated JS Date — events created in the same millisecond
  (e.g. within one transaction) are no longer skipped between pages — and
  cursor halves are validated (timestamp shape, UUID) so a crafted cursor
  yields an empty clause instead of a Postgres cast error. The route's limit
  parse is NaN-safe.
  
  In @fonderie/webhooks, `IPendingRetry` declared a nested
  `{ delivery, url, secret }` shape that the flat claim-query row never
  produced — `retry()` destructured `delivery` as undefined and threw on
  every claimed row, swallowed by `Promise.allSettled`. Net effect: failed
  deliveries were re-claimed every interval and never actually retried, with
  nothing logged. The type is now the flat row it always was, `retry()`
  destructures accordingly, and a new test pins the full path: claim →
  re-attempt with correct URL/signature → marked delivered.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/events@5.0.0

## 4.0.0

### Patch Changes

- Updated dependencies [2d4dac8]
- Updated dependencies [da7e79c]
  - @fonderie/core@0.4.0
  - @fonderie/store@0.2.0
  - @fonderie/events@4.0.0

## 3.0.0

### Patch Changes

- Updated dependencies [6e9f785]
  - @fonderie/core@0.3.0
  - @fonderie/events@3.0.0

## 2.0.0

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0

## 1.1.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

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
