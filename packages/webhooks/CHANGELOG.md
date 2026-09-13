# @fonderie/webhooks

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
