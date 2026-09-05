# DTO Gap Audit — 2026-09-05

Systematic sweep of every server DTO against (a) the SQL that feeds it, (b) the
mapper that emits it, and (c) the `@fonderie/client` type that mirrors it — the
detection mechanism that found the `IMemberDTO` identity gap, generalized. One
auditor per package surface; every candidate finding independently re-traced by
a skeptic and classified `genuine-gap` / `deliberate-omission` / `not-a-gap`.
Only genuine gaps are listed here; the three deliberate omissions the sweep
surfaced are recorded at the end so they stop resurfacing as findings.

Gap kinds: **fetched-but-discarded** (SQL selects it, mapper drops it),
**client-missing-field** (server sends it, client type lacks it),
**client-phantom-field** (client type claims it, server never sends it),
**type-mismatch**, **never-populated** (declared, no code path fills it),
**serialization-hazard** (Date/bigint reaching JSON, type-vs-wire lies).

Status convention (as in HOOK-GAP-AUDIT.md): unchecked = open. Check items off
as they are fixed; extend this file, don't fork it.

**Totals:** 37 candidates -> **33 confirmed genuine** (8 high, 16 medium, 9 low), 3 deliberate, 1 not-a-gap.


## auth

- [x] **[high] `IResendVerificationResult` — stat, message, data.token, data.expiresAt, data.email** (client-phantom-field) — **fixed in #137**
  - Evidence: packages/client/src/types.ts:88-96 declares { stat, message, data: { token, expiresAt, email } }, but the server's sendVerification never sends any of those: packages/auth/src/controllers/auth.controller.ts:713-715 returns result { email }, :682-686 returns { verified, email } when already verified, and the phone branch :666-670 returns no result at all. The 429 branch puts { retryAfter } into `details`, not `result` (packages/core/src/response.ts:43).
  - Fix: Replace IResendVerificationResult with { email?: string; verified?: boolean } (used by AuthClient.sendVerificationEmail at packages/client/src/modules/auth.ts:200-210). Any consumer reading result.data.token today gets a runtime TypeError — and the phantom `data.token` field falsely implies the server leaks the verification pin to the client.

- [x] **[high] `IMfaEnabledResult (MfaClient.verify response)` — tokens, user (phantom) / mfaEnabled (missing)** (client-phantom-field) — **fixed in #137** (also removed the hooks' phantom token rotation in react-auth/vue-auth/react-native-auth and rewrote their tests)
  - Evidence: packages/client/src/modules/auth.ts:76-83 types POST /auth/mfa/verify (setup confirmation, full session token) as IMfaEnabledResult { tokens, user } (packages/client/src/types.ts:109-112), but the setup-confirmation branch returns only { mfaEnabled: true } — packages/auth/src/controllers/mfa.controller.ts:94-96. The { tokens, user } shape is only produced on the mfaPending login path (mfa.controller.ts:156-169), which the client already types separately as ILoginResult in verifyLogin (modules/auth.ts:88-95). With a full session token and no pending secret, verify() can never reach the tokens branch (403 MFA_NOT_PENDING at mfa.controller.ts:100-104/126-131).
  - Fix: Retype MfaClient.verify's result as { mfaEnabled: boolean } (or split the endpoint's two personas into two result types). Code doing `result.tokens.access` or `result.user` after enabling MFA crashes at runtime.

- [x] **[medium] `IRegisterResult / ILoginResult` — requiresVerification** (client-missing-field) — **fixed in #141**
  - Evidence: Server email register and email login both send requiresVerification in the result: packages/auth/src/controllers/auth.controller.ts:147 and :296 (computed at :138 and :287). Client IRegisterResult (packages/client/src/types.ts:59-62) and ILoginResult (:64-67) omit it.
  - Fix: Add requiresVerification?: boolean to both client result types (optional: the phone branches at auth.controller.ts:216-219 and :343-346, and the MFA verifyLogin completion, omit it). Without it a typed UI cannot route to the verify-your-email screen after login/register — the exact signal the server computes for that purpose.

- [x] **[medium] `IUserDTO (exportMe profile)` — isPhoneVerified** (never-populated) — **fixed in #141**
  - Evidence: packages/auth/src/controllers/user.controller.ts:283 calls toUserDTO(user) without the phoneVerified argument, which defaults to false (packages/auth/src/dtos/user.ts:34, :52), while the same session's GET /users passes ctx.user!.phoneVerified (user.controller.ts:43). ctx.user is available in exportMe (used at :277).
  - Fix: Pass ctx.user!.phoneVerified at user.controller.ts:283. A phone-verified user's SAR data export reports isPhoneVerified: false, which is factually wrong in a compliance artifact. Same omission (lower stakes, email-only flows) at mfa.controller.ts:162 and oauth.controller.ts:117 — a user with a previously verified phone gets isPhoneVerified: false in those login responses too.

- [x] **[medium] `IUserPreferences` — dateFormat, timeFormat (and notifications/emailDigest shape)** (type-mismatch) — **fixed in #141**
  - Evidence: Server declares dateFormat?: string; timeFormat?: string optional (packages/auth/src/types.ts:11-12); client requires them as string (packages/client/src/types.ts:28-29). The mismatch is reachable, not just declarative: updatePreferencesSchema types all four pref keys as z.unknown() (packages/auth/src/schemas.ts:60-63), the controller patches any non-undefined value including null or wrong-typed JSON (packages/auth/src/controllers/user.controller.ts:83-88), and toUserDTO spreads stored prefs OVER the defaults (packages/auth/src/dtos/user.ts:45-47) — so a stored dateFormat: null overrides DEFAULT_PREFERENCES and reaches a client whose type promises string. The client's own IUpdatePreferencesInput (packages/client/src/modules/auth.ts:46-53) types these as unknown, inviting exactly that write.
  - Fix: Validate the four pref fields in updatePreferencesSchema (dateFormat/timeFormat/emailDigest as bounded strings, notifications as the {email,inApp,sms,push} boolean object) so the round-trip can't poison IUserDTO.preferences; or have toUserDTO sanitize per-key before spreading.

- [ ] **[low] `IUser row (USER_COLUMNS) / toUserDTO` — mfaSecret** (fetched-but-discarded)
  - Evidence: USER_COLUMNS selects mfa_secret AS "mfaSecret" (packages/auth/src/models/user.model.ts:31), fetched on every findById/findByEmail/findByPhone (:41-63), but IUser does not declare it (packages/auth/src/types.ts:16-37) and toUserDTO drops it (packages/auth/src/dtos/user.ts:34-60 — correctly). The only consumer reaches it through an unsafe cast: (user as unknown as { mfaSecret: string | null }).mfaSecret at packages/auth/src/controllers/mfa.controller.ts:223, even though a dedicated getMfaSecret() already exists (user.model.ts:242-248).
  - Fix: Drop mfa_secret from USER_COLUMNS and use users.getMfaSecret() in mfa.disable (as mfa.verify already does at mfa.controller.ts:133). This removes the untyped cast and stops hauling the encrypted TOTP secret through every user fetch — including the login and exportMe paths where it is never needed.

- [ ] **[low] `IRegisterInput / ILoginInput` — phone** (client-missing-field)
  - Evidence: Server registerSchema and loginSchema are unions accepting a { phone } variant (packages/auth/src/schemas.ts:21-34), and the controllers implement full phone OTP flows (auth.controller.ts:157-226, :306-353). Client IRegisterInput requires email+password and ILoginInput requires email+password (packages/client/src/modules/auth.ts:19-29) — phone auth is unreachable from the typed client, and there is no client method for the phone-verify completion (POST /auth/verify phone branch returning { tokens, user }, auth.controller.ts:583-596, vs client verifyEmail typed IVerifyEmailResult at modules/auth.ts:178-187).
  - Fix: If phone auth is meant to be client-reachable, widen the inputs to a union ({ email, password } | { phone }) and add a verifyPhone completion typed { tokens, user }; if email-only is deliberate for this cycle, add it to the allow-list with a reason like the wallet DTOs.


## billing

- [ ] **[medium] `ISubscriptionDTO` — currentPeriodStart / currentPeriodEnd / trialEndsAt / createdAt** (serialization-hazard)
  - Evidence: packages/billing/src/services/subscriptions.ts:15-19 (SELECT_SUBSCRIPTION selects TIMESTAMPTZ columns with no ::text cast; row typed as ISubscription) + packages/store/src/adapters/pg.ts:59-62 (no pg setTypeParser anywhere, so node-pg returns these as JS Date objects) vs packages/billing/src/types.ts:79-83 (ISubscription declares them string|null / string) and packages/billing/src/dtos/billing.ts:84-87 (toSubscriptionDTO passes them through into ISubscriptionDTO fields declared string at dtos/billing.ts:38-41). Client mirror packages/client/src/types.ts:153-156 declares string. The billing package itself documents the hazard: packages/billing/src/services/wallet.ts:362-364 ('node-pg parses timestamptz into a millisecond Date') and normalizes with new Date(r.createdAt).toISOString() at wallet.ts:421 — the subscription path is the outlier that skips normalization.
  - Fix: Normalize in the mapper or query like the wallet path does: either cast in SQL (created_at::text plus friends, or to_char/ISO) or map with value ? new Date(value).toISOString() : null in toSubscriptionDTO. Today the wire only stays correct because Date.prototype.toJSON happens to emit ISO strings; any non-JSON consumer of ISubscription (string comparison, cursor building, structured logging, cache key) gets a Date where the type says string.

- [ ] **[low] `IUsageResult (client mirror of GET /billing/usage/:metric)` — since** (serialization-hazard)
  - Evidence: packages/billing/src/controllers/usage.controller.ts:51-59 builds `since` as a raw JS Date (new Date() with setDate/setHours) and passes the Date object straight into the setApiResponse payload, so a Date reaches JSON.stringify; the client type packages/client/src/types.ts:179-183 declares since: string. There is no server-side DTO/mapper for this response at all — the shape exists only in the client.
  - Fix: Return since.toISOString() from the controller (and consider giving this response a server-side DTO so the shape is declared on both ends like every other billing response).

- [ ] **[low] `IUsageRecordDTO` — (entire DTO)** (never-populated)
  - Evidence: packages/billing/src/dtos/billing.ts:44-51 declares IUsageRecordDTO and dtos/billing.ts:129-138 defines toUsageRecordDTO, but the only reference outside the dtos file is the re-export at packages/billing/src/index.ts:77 — no controller or route ever calls it. The usage routes (packages/billing/src/routes.ts:59-60) return no body on record (usage.controller.ts:35) and {metric,total,since} on get (usage.controller.ts:56-60); packages/client/src/types.ts has no IUsageRecordDTO mirror (only IUsageResult at types.ts:179).
  - Fix: Either wire a route that emits it (e.g. a usage-history listing) or delete the DTO+mapper so the exported surface matches what the API actually sends.


## workspaces

- [x] **[high] `IWorkspaceDTO` — createdAt / updatedAt / archivedAt** (serialization-hazard) — **fixed in #138**
  - Evidence: packages/workspaces/src/dtos/workspace.ts:105-107 maps these with stringOrEmpty(); packages/core/src/parser.ts:1-3 shows stringOrEmpty returns '' for anything that is not already a string; packages/store/src/adapters/pg.ts:59-62 returns pg driver rows verbatim and a repo-wide grep finds no pg setTypeParser override, so timestamp/timestamptz columns arrive as Date objects, not strings. Result: in production every workspace timestamp serializes as ''. The client mirror claims real strings (packages/client/src/types.ts:210-212), and dtos/workspace.ts:104 proves the inconsistency is live — isArchived is derived true while archivedAt is emitted as ''. The core parser already has the correct helper, dateOrEmpty (packages/core/src/parser.ts:20-24), which the customers package uses for identical fields (packages/customers/src/dtos/customer.ts:143-144).
  - Fix: Replace stringOrEmpty with dateOrEmpty for the three timestamp fields in toWorkspaceDTO, matching the customers-package convention.

- [x] **[high] `IInvitationDTO` — expiresAt / createdAt** (serialization-hazard) — **fixed in #138**
  - Evidence: packages/workspaces/src/dtos/workspace.ts:145-146 uses stringOrEmpty on both; SELECT_INV fetches expires_at/created_at as raw timestamp columns (packages/workspaces/src/services/invitations.ts:36-37) which the pg adapter (packages/store/src/adapters/pg.ts:59-62, no type parsers configured) returns as Date objects, so stringOrEmpty (packages/core/src/parser.ts:1-3) emits ''. Client mirror declares them as real strings (packages/client/src/types.ts:245-246). expiresAt is the field a UI needs to show invite expiry — it will always be blank.
  - Fix: Use dateOrEmpty (packages/core/src/parser.ts:20-24) for both fields in toInvitationDTO.

- [x] **[high] `IMemberDTO` — createdAt** (serialization-hazard) — **fixed in #138**
  - Evidence: packages/workspaces/src/dtos/workspace.ts:129 maps createdAt with stringOrEmpty; SELECT_MEMBER fetches ruw.created_at (packages/workspaces/src/services/members.ts:11) as a raw timestamp, which the pg adapter returns as a Date (packages/store/src/adapters/pg.ts:59-62, no setTypeParser anywhere in the repo), so stringOrEmpty (packages/core/src/parser.ts:1-3) turns the member's join date into ''. Client mirror claims a string (packages/client/src/types.ts:230). Ironic footnote: the just-landed identity fix (commit 3a33e3a) added fields to this exact mapper while the date beside them silently empties.
  - Fix: Use dateOrEmpty for createdAt in toMemberDTO.

- [ ] **[medium] `IWorkspaceDTO` — archivedBy** (fetched-but-discarded)
  - Evidence: SQL fetches it in both column lists: packages/workspaces/src/services/workspaces.ts:19 (SELECT_WS, `archived_by AS "archivedBy"`) and :38 (SELECT_WS_W); the row type declares it (packages/workspaces/src/types.ts:28 `archivedBy: string | null`); but toWorkspaceDTO (packages/workspaces/src/dtos/workspace.ts:82-109) never emits it and IWorkspaceDTO (dtos/workspace.ts:14-31) lacks the field, as does the client mirror (packages/client/src/types.ts:196-213). This is the exact IMemberDTO class of bug: the DTO exposes isArchived and archivedAt (dtos/workspace.ts:104-105) but a client can never show who archived the workspace, even though every workspace query already pays for the column.
  - Fix: Either add archivedBy to IWorkspaceDTO + toWorkspaceDTO + the client mirror, or drop archived_by from SELECT_WS/SELECT_WS_W and IWorkspace if it is deliberately internal.


## audit

- [x] **[high] `IAuditPageDTO` — nextCursor** (never-populated) — **fixed in #139**
  - Evidence: packages/audit/src/routes.ts:28 caps limit at 200 and routes.ts:37 queries limit+1 to detect a next page, but packages/audit/src/models/event.model.ts:6,12 clamps the query to MAX_LIMIT=200, so at limit=200 the model returns at most 200 rows and the hasMore check at routes.ts:48 (events.length > limit) is never true
  - Fix: Make the route's over-fetch survive the model clamp: either raise MAX_LIMIT to 201, clamp the route's client-facing limit to MAX_LIMIT-1, or move the +1 over-fetch inside the model so the two caps can't cancel each other. Add a boundary test at limit=200 with 201 rows expecting a non-null nextCursor.

- [x] **[medium] `IAuditPageDTO` — nextCursor (cursor encoding)** (serialization-hazard) — **fixed in #139**
  - Evidence: packages/audit/src/dtos/audit.ts:29 encodes the cursor with createdAt.toISOString() (millisecond precision) while packages/events/src/migrations/sql/001_events.sql:6 stores created_at as TIMESTAMPTZ (microsecond precision); the keyset predicate at packages/audit/src/models/event.model.ts:41 compares (created_at, id) < ($ts, $id) against the truncated value, so events sharing the last row's millisecond but with nonzero sub-millisecond digits (e.g. all events emitted in one transaction, which share now() exactly) fail the tuple comparison and are silently skipped on the next page
  - Fix: Encode the cursor from a lossless representation: select created_at::text (or extract epoch microseconds) in AuditEventModel.list and feed that verbatim into encodeCursor, instead of round-tripping through a JS Date.


## webhooks

- [x] **[high] `IPendingRetry` — delivery** (never-populated) — **fixed in #139**
  - Evidence: packages/webhooks/src/models/delivery.model.ts:17-21 declares nested `delivery: IWebhookDelivery`, but the claimForRetry SQL at delivery.model.ts:82-92 returns flat columns (d.id, endpointId, eventId, ..., url, secret) with no `delivery` key — IStoreAdapter.query (packages/store/src/types.ts:2) does no nesting. Consumer: packages/webhooks/src/dispatcher.ts:40 destructures `{ delivery, url, secret }`, so delivery is undefined and attemptDelivery throws on `delivery.eventId` at dispatcher.ts:68; Promise.allSettled at dispatcher.ts:39 swallows the rejection, so module.ts:34's error logger never fires. Net effect: failed deliveries with a due next_attempt_at are re-claimed every retryInterval and never retried, silently. No test covers retry()/claimForRetry (packages/webhooks/src/__tests__/smoke.test.ts).
  - Fix: Have claimForRetry return flat rows typed as IWebhookDelivery & { url: string; secret: string } (or reassemble the nested shape in TS after the query), and add a retry() test that asserts a claimed failed delivery is actually re-POSTed and markResult is called.

- [ ] **[medium] `IWebhookDeliveryDTO` — responseBody** (fetched-but-discarded)
  - Evidence: packages/webhooks/src/models/delivery.model.ts:7 selects response_body as "responseBody" in the COLS used by listByEndpoint (delivery.model.ts:70-78), and markResult deliberately persists response bodies and fetch error messages into it (delivery.model.ts:55; dispatcher.ts:93,100) — but toDeliveryDTO (packages/webhooks/src/dtos/webhook.ts:40-51) omits it, and the client IWebhookDeliveryDTO (packages/client/src/types.ts:407-416) lacks it too. The field explaining WHY a delivery failed never reaches the client; not on the known-deliberate list.
  - Fix: Add responseBody: string | null to IWebhookDeliveryDTO in both dtos/webhook.ts and client types.ts, emitting it from toDeliveryDTO (optionally truncated).

- [ ] **[medium] `IWebhookDeliveryDTO` — nextAttemptAt** (fetched-but-discarded)
  - Evidence: packages/webhooks/src/models/delivery.model.ts:8 selects next_attempt_at as "nextAttemptAt" in listByEndpoint's COLS, but toDeliveryDTO (packages/webhooks/src/dtos/webhook.ts:40-51) drops it and the client mirror (packages/client/src/types.ts:407-416) has no such field. Clients can see status 'failed' but never whether/when a retry is scheduled.
  - Fix: Add nextAttemptAt: string | null (ISO) to both DTO copies and emit d.nextAttemptAt?.toISOString() ?? null from toDeliveryDTO.

- [ ] **[low] `IWebhookDeliveryDTO` — payload** (fetched-but-discarded)
  - Evidence: packages/webhooks/src/models/delivery.model.ts:6 selects the full JSONB payload column in the COLS used by listByEndpoint (delivery.model.ts:70-78, limit 50 rows, served by GET /webhooks/:endpointId/deliveries at packages/webhooks/src/routes.ts:157-179), but toDeliveryDTO (packages/webhooks/src/dtos/webhook.ts:40-51) discards it. Even if omitting payload from the DTO is intentional, fetching up to 50 full event payloads per list request and throwing them away is pure query waste.
  - Fix: Either add payload to the DTO if clients should see delivered event bodies, or use a slimmer column list (without payload/responseBody if those stay hidden) for listByEndpoint.


## customers

- [x] **[medium] `ICustomerEmailDTO / ICustomerPhoneDTO / ICustomerAddressDTO` — labelId** (fetched-but-discarded) — **fixed in #140**
  - Evidence: SQL selects label_id in every path: packages/customers/src/models/customer-email.model.ts:9, customer-phone.model.ts:9, customer-address.model.ts:8, and the detail queries at packages/customers/src/models/customer.model.ts:223,236,248; the mappers drop it: packages/customers/src/dtos/customer.ts:228-236 (toCustomerEmailDTO), 238-246 (toCustomerPhoneDTO), 248-255 (toCustomerAddressDTO). Client mirrors likewise lack it: packages/client/src/types.ts:458-464, 466-472, 484-489.
  - Fix: Emit labelId in the three DTOs (and the client mirrors). Without it the label-admin surface the client already ships (listLabels/removeLabel by label id, packages/client/src/modules/customers.ts:461-478 returning ICustomerLabelDTO.id at packages/client/src/types.ts:545-550) cannot be correlated with which emails/phones/addresses use a label except by fragile string matching on the label value.

- [x] **[medium] `ICustomerRelationshipExpandedDTO / ICustomerRelationshipExpandedD2DTO` — createdAt** (fetched-but-discarded) — **fixed in #140**
  - Evidence: The relationship row's created_at is selected (packages/customers/src/models/customer.model.ts:293, carried on ICustomerRelationshipExpanded at packages/customers/src/types.ts:110) but toCustomerRelationshipExpandedDTO (packages/customers/src/dtos/customer.ts:169-178) never reads r.createdAt — the flattened DTO's createdAt/updatedAt come from the related CUSTOMER via the ...customerFields spread (dtos/customer.ts:176, filled by toCustomerDTO at :143-144). Same in toCustomerRelationshipExpandedD2DTO (dtos/customer.ts:192-202). Contrast: the un-expanded ICustomerRelationshipDTO.createdAt IS the relationship's createdAt (dtos/customer.ts:154).
  - Fix: The same field name means 'relationship created' in ICustomerRelationshipDTO but 'customer created' in the expanded variants — a client sorting relationships by createdAt gets customer signup dates. Either add a distinct relationshipCreatedAt field carrying r.createdAt, or document the semantics on both server and client types (packages/client/src/types.ts:510-515).

- [x] **[medium] `IAddRelationshipInput (client) / addRelationshipSchema (server)` — relationship** (type-mismatch) — **fixed in #140**
  - Evidence: Client declares it optional: packages/client/src/modules/customers.ts:85 (relationship?: string), matching the zod schema packages/customers/src/schemas.ts:67 (z.string().max(100).optional()); but the controller hard-requires it: packages/customers/src/controllers/customer-relationship.controller.ts:58-60 returns 422 INVALID_PARAMETER when relationship is missing or empty.
  - Fix: A client following the published type and omitting relationship passes schema validation and is then guaranteed a 422. Make relationship required in IAddRelationshipInput and in addRelationshipSchema (min(1)), matching the controller.

- [x] **[medium] `IUpdateCustomerInput (client) / updateCustomerSchema (server)` — referralCode, referredByCode** (client-phantom-field) — **fixed in #140**
  - Evidence: packages/client/src/modules/customers.ts:53 aliases IUpdateCustomerInput = ICreateCustomerInput, which includes referralCode/referredByCode (customers.ts:49-50); updateCustomerSchema accepts them and they even satisfy its at-least-one-field refinement (packages/customers/src/schemas.ts:23-24,29-31); but the update controller reads only type/sex/firstName/lastName/companyName/avatarUrl/locale/referenceCode (packages/customers/src/controllers/customer.controller.ts:186-235) and CustomerModel.update has no referral columns (packages/customers/src/models/customer.model.ts:75-85).
  - Fix: updateCustomer(id, { referralCode: 'X' }) validates, returns 200 CUSTOMER_UPDATED, and changes nothing — a silent no-op. Give IUpdateCustomerInput its own shape without the two referral fields (and strip them from updateCustomerSchema), or implement the update path.

- [x] **[low] `ICustomerLabel / ICustomerLabelDTO` — createdAt** (serialization-hazard) — **fixed in #140**
  - Evidence: GET /customers/labels is the only customers response that bypasses DTO mapping: the controller returns raw model rows (packages/customers/src/controllers/customer-label.controller.ts:22-23); the query selects created_at with no normalization (packages/customers/src/models/customer-label.model.ts:10) and the pg adapter registers no type parsers (packages/store/src/adapters/pg.ts:59-62), so createdAt is a JS Date at runtime despite ICustomerLabel.createdAt: string (packages/customers/src/types.ts:9). Every other DTO runs dateOrEmpty (packages/core/src/parser.ts:20-24).
  - Fix: Date.prototype.toJSON happens to emit ISO-8601 so the wire matches ICustomerLabelDTO.createdAt: string (packages/client/src/types.ts:549) today, but any server-side consumer of labels.list() doing string ops on createdAt breaks, and a driver/serializer change breaks the wire. Add a toCustomerLabelDTO mapper using dateOrEmpty like every sibling.

- [x] **[low] `ICustomerTagDTO` — tag (entire DTO)** (never-populated) — **fixed in #140**
  - Evidence: ICustomerTagDTO and toCustomerTagDTO are defined (packages/customers/src/dtos/customer.ts:122-124, 267-271) and exported (packages/customers/src/index.ts:11,21) but no controller uses them — the tag routes emit plain string[] (packages/customers/src/controllers/customer-tag.controller.ts:41-44, model returns string[] at packages/customers/src/models/customer-tag.model.ts:6-14), which is what the client declares (packages/client/src/types.ts:594-596).
  - Fix: Dead public surface: a consumer importing ICustomerTagDTO from @fonderie/customers will type tag responses as { tag: string }[] and be wrong. Delete the DTO+mapper or actually use them.


## admin-and-inputs

- [ ] **[high] `IConfigEntry / IConfigRevision (config admin)` — value** (type-mismatch)
  - Evidence: packages/config/src/services/config.ts:12 selects the raw TEXT column (`value TEXT NOT NULL`, packages/config/src/migrations/sql/001_config.sql:4) and returns it unparsed (same for revisions at services/config.ts:101), while the runtime read path JSON.parses it (packages/config/src/manager.ts:102). The client type claims a parsed `value: unknown` (packages/client/src/types.ts:328, :340), so getConfig() after setConfig(key, {value: {a:1}}) returns the string '{"a":1}', not the object sent. The shipped editor then double-encodes: packages/react-config-admin-screens/src/screens/ConfigEditorScreen.tsx:57 does JSON.stringify(entry.value) on an already-stringified value, rendering escaped JSON ('"{\"a\":1}"') in the textarea.
  - Fix: In the admin read/write-returning paths, JSON.parse the value with a raw-string fallback (mirroring manager.ts:102-115) before emitting the entry/revision, so the wire value matches what setConfig accepted and what the runtime resolves; then the client's `value: unknown` and the editor's JSON.stringify become correct.

- [ ] **[medium] `IConfigEntry / ISecretEntry (config admin write path)` — active** (never-populated)
  - Evidence: setConfigEntry/setSecret accept `active?: boolean` (packages/config/src/services/config.ts:65, secrets.ts:82) but the admin route's writeOpts only forwards environment/description/ifVersion (packages/config/src/admin.ts:71-83), so every HTTP write forces active=true (services/config.ts:72, services/secrets.ts:91). Client inputs ISetConfigInput/ISetSecretInput also lack `active` (packages/client/src/modules/config-admin.ts:13-17, :19-23). Yet IConfigEntry.active is exposed (packages/client/src/types.ts:331) and environment-scoped list reads filter on `active = true` (services/config.ts:38, secrets.ts:38) — a filter no API caller can ever trip. Courier's parallel surface DOES wire it through (packages/courier/src/templates/admin-routes.ts:76 reads b['active']; client ISetTemplateInput has active?: boolean at packages/client/src/modules/courier-admin.ts:10).
  - Fix: Read b['active'] in writeOpts (or the PUT handlers) like courier does, and add `active?: boolean` to ISetConfigInput and ISetSecretInput; otherwise drop the active filter/field from the admin surface.

- [ ] **[medium] `ITemplateEntry / IConfigEntry / revisions (admin write attribution)` — updatedBy / actor** (client-missing-field)
  - Evidence: Both admin surfaces record the writer from the X-Actor header, defaulting to 'admin-token' (packages/courier/src/templates/admin-routes.ts:28, packages/config/src/admin.ts:53-55), and both DTOs surface it (updatedBy at packages/client/src/types.ts:306, :333; revision actor at :317, :342) — the shipped screens render revision history from it. But CourierAdminClient/ConfigAdminClient have no way to send the header: HttpClient builds headers only from token/cookie/workspaceId (packages/client/src/http.ts:97-100), and neither client options object accepts an actor (packages/client/src/modules/courier-admin.ts:18-21, config-admin.ts:29-32). Every write from the admin dashboards is attributed 'admin-token', making the exposed updatedBy/actor fields useless for their purpose.
  - Fix: Add an optional `actor` to ICourierAdminClientOptions/IConfigAdminClientOptions (or per-call), plumb an extra-headers option through HttpClient.exec, and send X-Actor on writes.

- [ ] **[medium] `IWorkspaceDTO.address (updateWorkspaceSchema addressSchema)` — region / postalCode vs state / zip** (never-populated)
  - Evidence: The zod addressSchema validates `region` and `postalCode` (packages/workspaces/src/schemas.ts:24-25), but the persisted/read shape uses `state`/`zip`: toWorkspaceDTO emits addr.state/addr.zip (packages/workspaces/src/dtos/workspace.ts:97-98) and the client sends/reads state/zip (packages/client/src/modules/workspaces.ts:35-36, packages/client/src/types.ts:190-192). The client's keys only survive because of .passthrough() (schemas.ts:28) — so the fields actually used are completely unvalidated (no max length), while a schema-conformant caller sending region/postalCode has them stored in the jsonb column (packages/workspaces/src/services/workspaces.ts:169-170) but silently never returned by any read.
  - Fix: Rename the schema fields to state/zip (matching the DTO and client) so the real fields get the max-length validation, and drop or alias region/postalCode.

- [ ] **[medium] `customers updateEmailSchema / updatePhoneSchema / updateAddressSchema` — email, phone, address fields, isPrimary** (never-populated)
  - Evidence: The PATCH schemas accept content changes and isPrimary (email.optional() + isPrimary at packages/customers/src/schemas.ts:36-38; phone at :41-43; all address fields at :57-59) and their refine() passes with any one field. But all three controllers only apply `label` and 422 without it: customer-email.controller.ts:100-107, customer-phone.controller.ts:100-107, customer-address.controller.ts:111-118 (all in packages/customers/src/controllers/). A schema-valid body {"isPrimary": true} passes validation then fails 'label is required'; {"label": "work", "isPrimary": true} silently drops isPrimary. The client types are the honest side — updateEmailLabel/updatePhoneLabel/updateAddressLabel take label only (packages/client/src/modules/customers.ts:213, :264, :315).
  - Fix: Shrink the three update schemas to `{ label: z.string().min(1).max(100) }` to match what the controllers implement (setPrimary already has its own route), or implement the extra fields in the controllers.

- [ ] **[low] `IUpdateProfileInput (auth)` — firstName / lastName / avatarUrl nullability** (type-mismatch)
  - Evidence: Server updateProfileSchema accepts explicit null to clear each field (.nullable().optional(), packages/auth/src/schemas.ts:47-49), but the client input types them as `string | undefined` only (packages/client/src/modules/auth.ts:41-43), so a typed caller can never clear an avatarUrl or name. The sibling IUpdateWorkspaceInput does model the same server pattern as `string | null` (packages/client/src/modules/workspaces.ts:27-30), so the omission is an inconsistency, not a convention.
  - Fix: Type the three fields as `string | null | undefined` to match the schema, like IUpdateWorkspaceInput does.

- [ ] **[low] `IRegisterInput / ILoginInput (auth)` — phone variant** (client-missing-field)
  - Evidence: registerSchema and loginSchema are unions whose second branch is `{ phone }` (packages/auth/src/schemas.ts:21-29, :31-34), but the client inputs only model the email branch with required email+password (packages/client/src/modules/auth.ts:19-29), so phone-based register/login is unreachable through the typed client.
  - Fix: If phone auth is client-facing, widen the inputs to the union (`{email, password, ...} | {phone}`); if it is deliberately server/CLI-only, add it to the coverage-gate allow-list with a reason.


## Adjudicated as deliberate (do not re-report)

- **billing / `IPlanDTO` — pricingStale** (never-populated; deliberate-omission): The auditor traced the behavior correctly — pricingStale is only ever set inside hydratePricing (plan.controller.ts:40,44), which runs only when config.pricing?.hydration === true (plan.controller.ts:50,56,73) — but chose the wrong side as authoritative. The design doc config.ts:23 points to (packages/billing/docs/pricing-hydration.md) consistently defines pricingStale as a hydration-era signal: s
- **workspaces / `IInvitationDTO` — pin** (fetched-but-discarded; deliberate-omission): The auditor's inconsistency argument does not survive tracing the route surface. PIN is the only live accept credential: routes.ts:66 wires only invitation.accept -> acceptByPin, and acceptInvitationByToken (services/invitations.ts:136-172) is exported from services/index.ts:33 but mounted on NO route and used by no controller (repo grep confirms), so 'token grants membership to any presenter' is 
- **customers / `ICustomerRelationshipExpandedD2DTO (server + client)` — addresses (on depth-2 nested customers)** (never-populated; deliberate-omission): Verified the facts: depth-2 always sets addresses: [] (customer.model.ts:475) and the DTO/client types still declare addresses: ICustomerAddressDTO[] with no signal. But the omission is explicitly intentional and documented in code: the comment at customer.model.ts:421-422 says 'Addresses are omitted at depth-2: family members share the parent tenant's address and duplicating it inflates mobile pa

## Coverage

Per-package auditor coverage statements (what was actually compared, so silence
is auditable):

- **auth**: Audited the full packages/auth ↔ @fonderie/client auth surface in the current working tree. Server side: dtos/user.ts (IUserDTO + toUserDTO — the only DTO file in the package), types.ts (IUser, IUserPreferences, ISession, IMfaChallenge), models/user.model.ts (USER_COLUMNS select list and every query/update), session.model.ts usage via exportMe, all four controllers' response payloads line-by-line (auth.controller.ts: register both branches, login both branches, logout, refresh, forgot/reset password, verify both branches, sendVerification both branches; user.controller.ts: me, updateProfile, u
- **billing**: packages/billing full DTO surface vs client: (1) IPlanDTO — toPlanDTO (dtos/billing.ts:53-72) vs SELECT_PLAN / createPlan / updatePlan RETURNING lists (services/plans.ts:107-121,151-179,219-232), IPlanRow bigint-money mapping via moneyToNumber (utils.ts:13-18), hydratePricing override path (controllers/plan.controller.ts:16-46), client IPlanDTO+IPlanFeature (client/src/types.ts:116-141), ICreatePlanInput/IUpdatePlanInput (client/src/modules/billing.ts:26-40) vs createPlanSchema/updatePlanSchema (schemas.ts:9-29) and the controller field allow-list (plan.controller.ts:87-99,119-125). monthlyPri
- **workspaces**: Exhaustive over packages/workspaces. Server side: all DTOs and mappers in packages/workspaces/src/dtos/workspace.ts (IWorkspaceDTO/IWorkspaceAddressDTO/IRoleDTO/IMemberDTO/IInvitationDTO/IWorkspaceSettingsDTO and toWorkspaceDTO/toRoleDTO/toMemberDTO/toInvitationDTO/toSettingsDTO); row types in src/types.ts; every SQL column list in src/services/workspaces.ts (SELECT_WS, SELECT_WS_W, settings queries), src/services/members.ts (SELECT_MEMBER, getUserRoles select), src/services/roles.ts (SELECT_ROLE, getRolePermissions select), src/services/invitations.ts (SELECT_INV, accept-by-pin/token selects)
- **audit**: packages/audit full surface: dtos/audit.ts (IAuditEventDTO, IAuditPageDTO, toAuditEventDTO, encodeCursor, decodeCursor), models/event.model.ts (AuditEventModel.list SQL select list, WHERE/cursor predicate, MAX_LIMIT clamp), routes.ts (GET /audit handler, limit parsing, hasMore/nextCursor computation), types.ts (IAuditEvent, IAuditQuery); events substrate feeding the table: packages/events/src/types.ts (IEventMeta/IEventRecord), transports/pg.ts publish INSERT, migrations/sql/001_events.sql schema; client side: packages/client/src/modules/audit.ts (AuditClient.listEvents, IListAuditEventsInput,
- **webhooks**: packages/webhooks full surface: dtos/webhook.ts (IWebhookEndpointDTO, IWebhookEndpointCreatedDTO, IWebhookDeliveryDTO + toEndpointDTO/toEndpointCreatedDTO/toDeliveryDTO); src/types.ts row types (IWebhookEndpoint, IWebhookDelivery); models/endpoint.model.ts (COLS + create/list/findById/update/delete/findForEvent SQL) and models/delivery.model.ts (COLS, D_COLS, create/markResult/listByEndpoint/claimForRetry, IPendingRetry); routes.ts all 7 routes (POST/GET/GET:id/PATCH/DELETE /webhooks, GET deliveries, POST test) including inline test-result payloads; dispatcher.ts and module.ts retry wiring; sc
- **customers**: Compared the full packages/customers surface against @fonderie/client. Server side: all 13 DTO interfaces and all 8 mappers in packages/customers/src/dtos/customer.ts (ICustomerDTO, ICustomerShallowDTO, ICustomerDetailDTO, ICustomerDetailD2DTO, ICustomerRelationshipDTO, ICustomerRelationshipExpandedDTO, ICustomerRelationshipExpandedD2DTO, ICustomerEmailDTO, ICustomerPhoneDTO, IAddressDTO, ICustomerAddressDTO, ICustomerNoteDTO, ICustomerTagDTO); every SQL SELECT/RETURNING column list in models/customer.model.ts (incl. the depth-1/depth-2 findDetail fan-out), customer-email/phone/address/note/ta
- **admin-and-inputs**: Compared: (1) Courier admin — @fonderie/courier ITemplateEntry/ITemplateRevision + SQL (src/templates/admin.ts ENTRY_COLS, revision SELECT) + admin-routes.ts handlers vs client ITemplateEntry/ITemplateRevision (types.ts:298-319) and CourierAdminClient's ISetTemplateInput/IRollbackTemplateInput — field sets match exactly; no output gaps. (2) Config admin — @fonderie/config IConfigEntry/IConfigRevision/ISecretEntry/ISecretRevision + SQL (services/config.ts, services/secrets.ts, migrations 001-003) + admin.ts routes vs client mirrors (types.ts:326-368) and ConfigAdminClient's ISetConfigInput/ISet

## Related, already addressed

- Timing-safe secret comparison sweep -> PR #135 (courier admin guard, TOTP compare).
- `IMemberDTO` identity fields + `IUserDTO`/`IPlanDTO` realignment -> `feat/route-coverage-gate` (#133), brain docs regenerated.
- Numeric-conversion audit: all `bigint`/`Number`/`parseInt` sites are either
  guarded (`toSafeNumber`, formerly `moneyToNumber`) or operate on counts, not money.
  One niche flag: `StripeProvider.toResolvedPrice` maps a price defined only via
  `unit_amount_decimal` (sub-cent pricing) to `0n` silently (`unit_amount ?? 0`)
  — decimal prices are unsupported; hydration would display 0.
