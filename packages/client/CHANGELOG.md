# @fonderie/client

## 3.17.0

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

## 3.16.0

### Minor Changes

- 0484418: The operator's side of account deletion (docs/ACCOUNT-DELETION-DESIGN.md, Phase 5).
  
  An operator could see that an account was deleted, but not when it would be erased, and could do nothing about it: not keep it for a person who asked support, not stop the erasure of an account under dispute, not erase one at once for an urgent verified request, and not show an auditor that an erasure happened.
  
  - **Pending deletions.** Each archived account in the console shows when deletion was requested, when it will be erased, the channel it was confirmed by and whether the reminder went out (`IAdminUserDTO.deletion`).
  - **Cancel on request** (`POST /_admin/users/:id/deletion/cancel`): the account is active again, `fonderie.user.restored` resumes billing, and the person is told on the channel they deleted with.
  - **Legal hold** (`POST|DELETE /_admin/users/:id/deletion/hold`): the schedule neither reminds nor erases a held account until the hold is lifted; a hold must say why. Lifting it is a DELETE, so the console asks for a fresh authenticator code.
  - **Erase now** (`DELETE /_admin/users/:id/deletion`, `eraseAccountNow`): only an account the person already asked to delete and that is not held; every eraser runs as on the schedule, and the receipt records `initiated_by: 'operator'`. Refused when the app gave no erasers, which would leave every other brick's data behind.
  - **Receipts** (`GET /_admin/erasures`, `/_admin/erasures/export`): newest first, found by the address the person used (hashed with the same key, so `+tag` and case variants match), exported as CSV or JSON. They name no one.
  
  Apply auth migration `024_deletion_hold` before deploying. For "erase now" to work, pass your erasers to `AuthModule` in `accountDeletion.erasers`, the same list the schedule runs.

## 3.15.0

### Minor Changes

- 33ac39a: Deleting an account now takes proof and can be undone until the purge
  (docs/ACCOUNT-DELETION-DESIGN.md, Phase 2).
  
  - **Request with a code** — `POST /users/me/deletion { channel: 'email' | 'sms' }`
    sends a 6-digit code (15 min, one per minute, five tries) to that address;
    `POST /users/me/deletion/confirm { code, mfaCode? }` archives the account in one
    statement (closed, every session and pending code gone) and sends "your account
    will be deleted on …" on the same channel. Two-factor accounts also give a
    second factor. `DELETE /users` still works and is deprecated.
  - **Keep my account** — signing in to an archived account (password, Google /
    Apple, or phone code) answers `403 ACCOUNT_PENDING_DELETION` with `requestedAt`,
    `deleteOn`, `mfaRequired` and a 10-minute `restoreToken`;
    `POST /auth/account/restore { restoreToken, mfaCode? }` un-archives it and signs
    in. Phone sign-in to an archived account now sends its code and offers the same.
  - **Not while owning a team** — `accountDeletion.blockers`; `@fonderie/workspaces`
    ships `accountDeletionBlocker(store)`: refused (`409 OWNS_TEAM_WORKSPACE`) while
    the person owns a workspace other people belong to.
  - **Billing** — on deletion the default is now `cancel-at-period-end` (was
    `cancel`): nothing more is charged and keeping the account resumes it
    (`fonderie.user.restored`). A cancellation the person chose is never undone.
  - **One-time codes are spent once under a race** — a backup code (MFA sign-in,
    and the new second-factor checks) and a password-reset code could each be used
    twice by concurrent requests; both are now spent atomically.
  - **Client** — `auth.requestAccountDeletion / confirmAccountDeletion /
    restoreAccount`, `pendingDeletionOf(err)`; hooks `useAccountData().requestDeletion
    / confirmDeletion` and `useRestoreAccount` (React, React Native, Vue); messages
    for `OWNS_TEAM_WORKSPACE` and `RESTORE_TOKEN_INVALID` in five languages.
  
  **Apps:** run migrations before deploying (auth `022`, billing `016`, additive);
  route `account-deletion-code`, `account-deletion-scheduled` and `account-restored`
  to `['email', 'sms']` in courier; wire `accountDeletion: { gracePeriodDays,
  blockers: [accountDeletionBlocker(store)] }`.

## 3.14.0

### Minor Changes

- 9a9a816: `localizeApiError` says what an archived account means, in the reader's
  language: after sign-in, "This account is scheduled for deletion on 3 November
  2026. You can still keep it." (`ACCOUNT_PENDING_DELETION` with `details.deleteOn`),
  and at sign-up, where no date is sent, a short sentence pointing to signing in.
  Until now these fell back to the generic "You don't have permission".
  
  Two general improvements: a detail that is an ISO instant is shown as a date in
  the reader's language (never a raw timestamp), and a reason may have a
  `'<REASON>:short'` sentence used when its details are absent.

## 3.13.1

### Patch Changes

- 7ec7033: **Security:** a manager could strip manager rights from every other manager —
  and from the owner. `addMemberRole` refuses system roles, but
  `DELETE /workspaces/members/:userId/roles/:roleId` did not: give the target any
  custom role (so ADMIN is not their last), then delete their ADMIN row. Two
  calls, no owner involved, nobody told. System roles (ADMIN, GUEST) are now
  refused there with `403 SYSTEM_ROLE`; manager rights come off only through the
  owner-only `DELETE /workspaces/members/:userId/manager`.
  
  The removal is also atomic now: the member's role rows are locked for the
  check and the delete, so two removals racing on a two-role member can no longer
  both pass "more than one role left" and leave them with none. Outcomes have
  their own reasons: `ROLE_NOT_HELD` (404), `LAST_ROLE` (400), `SYSTEM_ROLE` (403),
  translated in the client's error dictionaries.

## 3.13.0

### Minor Changes

- 8d1aa7d: Accepting an invitation now says WHY it failed, and a link only joins the
  account it was sent to.
  
  - Every refusal was `400 INVITATION_FAILED` with an English sentence, so apps
    told "expired" from "already used" by parsing text. Each now has its own
    reason: `INVITATION_NOT_FOUND` (404 — also a link replaced by a resend),
    `INVITATION_EXPIRED` (410), `INVITATION_REVOKED` (410), `INVITATION_ALREADY_USED`
    (409), `INVITATION_ROLE_UNAVAILABLE` (409), `INVITATION_EMAIL_MISMATCH` (403),
    and `NO_EMAIL_ON_ACCOUNT` for a PIN on an account without email. Unexpected
    errors are 500s instead of a misleading 400.
  - **Behaviour change:** an invitation link accepted by a signed-in account whose
    email is not the invited one is refused (`INVITATION_EMAIL_MISMATCH`, with
    `details.email` a masked hint such as `a***@acme.example`), and the link stays
    usable by the invitee. Accounts with no email (phone sign-up) still accept with
    the link. Configure with `invitationAccountMatch`: `'email-when-present'`
    (default), `'email'` (also refuse accounts without email) or `'any'` (previous
    behaviour).
  - **'+tag' addresses are the same person.** Accounts are stored under
    `normalizeEmail` (lowercase, `+tag` dropped), but invitations compared the
    typed address by case only — so an invite to `ana+crew@acme.example` could
    never be accepted by PIN by Ana's account `ana@acme.example` (and would not
    have matched the new link check either), and inviting an alias of an existing
    member counted a new seat. Invitations now compare with the same rule
    (pinned to auth's `normalizeEmail` by a test). The email still goes to the
    address as typed.
  - `@fonderie/client` translates the new reasons in en, fr, es, zh-Hans and zh-Hant.

## 3.12.0

### Minor Changes

- 2686f16: Error messages in the reader's language. The screens showed the server's English sentence to everyone; a wrong password now reads « Le courriel ou le mot de passe est incorrect. » for a fr-CA user, 「電子郵件或密碼不正確。」 for zh-TW.
  
  - **`localizeApiError(error, locale)`** (client):
    - English readers keep the server's exact sentence.
    - Every other language gets the message for the error's reason code, filled from its `details`.
    - If the code is unknown or a value is missing, they get the generic message for the status, never a half-filled sentence.
    - An offline failure reads "couldn't reach the server" in every language, instead of "TypeError: Failed to fetch".
    - Covers 57 user-facing reason codes (sign-in, teams, billing, customers, uploads) plus 12 generic messages, in en/fr/es/zh-Hans/zh-Hant.
  - **`useUiError(source?, locale?)`** in `@fonderie/react` and `@fonderie/vue` returns that function in the app's UI language, following `setLocale()`.
  - **Every prebuilt screen** (all 18 packages) shows errors through it.
  - **Server:** `PLAN_UNCHANGED` (`plan`, `interval`), `FEATURE_UNAVAILABLE` (`feature`), `ASSET_TOO_LARGE` (`maxBytes`, `maxMegabytes`) and `ASSET_UNSUPPORTED` (`allowed`) now send their values in `details`, like the other messages that name a value. The English sentences are unchanged.

## 3.11.0

### Minor Changes

- 09e227e: The prebuilt screens speak the app's language: English, French, Spanish, and Chinese in Simplified and Traditional.
  
  - **One UI language per client.** `new FonderieClient({ locale: 'fr-CA' })`, `client.setLocale()`, `getLocale()`, `onLocaleChange()`; the default is the device's language. Every sub-client shares it, so a screen handed only `client.auth` follows it too. Requests now carry it as `Accept-Language`, a CORS-safelisted header, so no preflight is added.
  - **The screens' words** live in `@fonderie/client` (`ui-i18n/<domain>/<language>.ts`), shared by React, React Native and Vue: auth, billing, customers, workspaces, audit and webhooks, about 225 keys including React Native's screen-reader labels. Every language is typed against English, so a missing key won't compile. A parity test checks every string is non-empty with the same `{placeholders}`, and that Traditional is not the Simplified copy. French is written for Canada (« courriel »). `zh-TW`/`zh-HK`/`zh-MO` get Traditional and `zh`/`zh-CN`/`zh-SG` Simplified; other languages fall back to English.
  - **Hooks:** `useUiT(source?, locale?)` and `useUiLocale(source?, locale?)` in `@fonderie/react` (React and React Native) and `@fonderie/vue`. They follow `setLocale()` live.
  - **Every screen in the 18 packages** takes an optional `locale` prop (one screen in another language) and has no English left in it.
  - **Formatting follows the language too:** prices (were hard-coded `en-US`), renewal dates and audit timestamps. Server status words (subscription status, roles, invitation status, webhook delivery status) are translated, and an unknown value shows as-is.
  - **Fixes found on the way:**
    - The register screens send the UI language, so a new account starts in the language it signed up in (it always defaulted to en-US).
    - The team screens show each member's name (in the language's name order, e.g. 王小明), email and all their roles, instead of the user id.
    - React Native's subscription screen shows a Stripe Link payment method (it showed an empty card line; React and Vue were fixed in #605).
    - A subscription set to cancel says "Ends {date}", not "Renews {date}".
    - `formatPersonName()` in client.

## 3.10.0

### Minor Changes

- 8f45758: The admin console in Chinese, Simplified (简体中文) and Traditional (繁體中文).
  
  - All 609 console strings in `zh-Hans` and `zh-Hant`, alongside English, French and Spanish. The language menu lists both. The Traditional copy uses Taiwan/Hong Kong software terms (使用者, 設定, 範本, 權杖, 工作階段), not a character conversion of the Simplified copy.
  - `detectAdminLocale` picks the script from the browser's language: `zh-TW`, `zh-HK` and `zh-MO` get Traditional; `zh`, `zh-CN` and `zh-SG` get Simplified.
  - `ADMIN_LOCALES` is now `['en', 'fr', 'es', 'zh-Hans', 'zh-Hant']`. The parity test checks both scripts for empty strings and dropped `{placeholders}`, and checks that Traditional is not a copy of Simplified.
  - `@fonderie/admin` bumps so the console it ships includes the new language.

## 3.9.0

### Minor Changes

- 3f521bc: A business profile fit for Canada and the US, and customers that are safe to delete and speak their own language.
  
  **Country rules as data: `@fonderie/core/region`.** One registry decides what a valid province, postal code or tax number is, per country. Fonderie ships Canada (English and French names: Québec, Colombie-Britannique…; `A1A 1A1`; GST/HST, QST, PST, BN) and the United States (states and territories; ZIP and ZIP+4; EIN, state sales-tax permits). An app adds any other country with `regions.register({ code: 'MX', … })`. A country without a pack is stored as given, never judged by another country's rules.
  
  **Business profile (`PUT /workspaces`)**: `legalName`, `email`, `website`, `logoUrl`, `taxRegistrations` (`{ country, type, number, region?, label? }`, checked and normalized against the country, e.g. `123 456 789 rt 0001` → `123456789RT0001`), and `languages`, the languages the business serves customers in (`['en-CA', 'fr-CA', 'zh-Hant']`). The address is normalized (`Canada`/`Québec`/`h2x1y4` → `CA`/`QC`/`H2X 1Y4`). `businessType` is now one of `SOLE_PROP`, `PARTNERSHIP`, `LLC`, `INC`, `NONPROFIT`, `COOPERATIVE`. Settings check `locale` (BCP 47, canonical), `currency` (ISO 4217) and `timezone` (IANA). Every refusal is a 422 naming the field. Migration `workspaces/005`.
  
  **Customers**
  - **Language**: `locale` is validated and canonical, and defaults to the business's own (workspace settings) instead of `en-US`. `displayName` writes the name in the customer's language's order: `王小明` for Chinese, Japanese and Korean, `Marie Tremblay` otherwise, the company name for a business.
  - **Archive** (`POST /customers/:id/archive|unarchive`, `archiveCustomer`): hidden from lists and pickers, still readable by id for the documents that name them. Lists exclude archived customers unless `archived: true | 'all'`. Migration `customers/014`.
  - **Safe delete**: one transaction. A customer still referenced (a database foreign key, or the new `isInUse(customerId, workspaceId)` config hook) is refused with `409 CUSTOMER_IN_USE` and loses nothing. Before, its emails, phones and notes were deleted first and the customer then survived without them.
  - **Search** also matches any email, and any phone by digits (`514 555` finds `+1 (514) 555-0100`). The count always describes the same rows.
  - **Primaries can't be lost**: setting a primary email, phone, address or relationship with an id that isn't this customer's now answers 404 and keeps the current primary. Before, it cleared every primary.
  - **Relationships**: the expanded relationship now has `relatedId` (the related customer) and `relationshipId`. `id`/`customerId` stay as deprecated aliases; `id` was the relationship's id, which apps read as the customer's.
  - Addresses use the same country rules.
  
  **Hooks**
  - `useCustomer()` gains `deleteCustomer`/`archiveCustomer`/`unarchiveCustomer`; `useCustomers()` gains `archiveCustomer`/`unarchiveCustomer`.
  - Section hooks take `{ read: false }` for their actions only, so a detail screen makes one request instead of one per section.
  - `@fonderie/react`: refreshing a disabled query no longer fetches it. A write made through a hook told not to read, or still waiting for an id, used to request that hook's list anyway.

## 3.8.0

### Minor Changes

- 64aefa4: Permissions work end to end, from one declared list to the button a member sees.
  
  - **One catalog**: `new PermissionsModule(store, { catalog: [{ key: 'jobs' }, { key: 'reports', operations: ['read'] }] })`. A role editor reads it (`GET /workspaces/permissions/catalog`, `usePermissionCatalog`). Saving a role refuses a key outside it (`422 UNKNOWN_PERMISSION`) or an operation the resource does not have (`422 UNSUPPORTED_OPERATION`), so no switch can promise a restriction the server never checks.
  - **Rights for the built-in roles, from config**: `systemGrants: { GUEST: { jobs: ['read'] } }`. The system roles are shared by every workspace, so their rights are read from config at check time: every workspace, existing ones included, has them at once, with no seeding or backfill. A workspace's own role named `GUEST` gets none of them. A `systemGrants` key missing from the catalog stops the app at boot.
  - **What may I do here?** `GET /workspaces/current/permissions` returns `isOwner`, `isManager`, `isSuper` and per-resource rights (the union across all the member's roles). `usePermissions()` / `useCan(op, resource)` in React, React Native and Vue answer **no until the server has answered**, and re-read on a workspace switch and after any workspace write (a role change).
  - **Customers obey permissions**: `new CustomersModule(store, { permission: 'customers' })`. Reads need `read`; creating a customer `create`; deleting one `delete`; every other write (emails, notes, tags, blacklist…) `update`. Unset: unchanged.
  - **Deleting a role** now also removes its assignments and grants (before, they were left pointing at nothing). Anyone for whom it was the only role stays on the team with the default role, and the response (and `useRoles().removeRole`) says `{ membersAffected, movedToDefaultRole }`.
  - Hooks taking an id (`useRole`, `useRolePermissions`, `useMemberRoles`, `useWorkspace`) wait instead of requesting with an empty one.

## 3.7.0

### Minor Changes

- cb678f7: Members and invitations work end to end.
  
  - **Invite without picking a role**: the person joins with the default role; the default role named explicitly is accepted, a manager role is refused.
  - **Accept by link**: set `invitationUrl` (e.g. `https://app.example.com/invite/{token}`) and the invitation email carries the link, the workspace name and who invited, with the PIN as fallback. `client.workspaces.acceptInvitation({ token } | { pin })`; a bare string is still a PIN. The prebuilt accept screens sent the link's token as a PIN, so they could never succeed; they now send it as a token.
  - **The invitation email** (en/fr/es) shows the link when one is configured, the workspace name and who invited, and always the PIN. Courier migration `006` upgrades the seeded `workspace-invitation` row to the same copy, but only if nobody edited it; the change is recorded as a revision the console can roll back. Without it, existing installs would keep sending the PIN-only email.
  - **A link joins one person**: accepting is single-use, even when two people race for one forwarded link.
  - **One pending invitation per address**, whatever the case: re-inviting refreshes it instead of stacking a duplicate (migration `004` adds the unique index and cancels existing duplicates). `resendInvitation` sends a new link and PIN; invitations past expiry are listed with `isExpired`.
  - **Seats** count each person once, plus pending invitations, never the owner. Adding a role never makes someone a member.
  - **Members list**: one row per person, with `roles[]`, `isOwner` and `isManager`.
  - **Manager path**: the owner can make a member a manager (`setManager` / `unsetManager`), hand over the workspace (`transferOwnership`; the previous owner stays as a manager), and any member can `leaveWorkspace` (the owner must hand over first).
  - **`GET /workspaces/current`** and `useCurrentWorkspace()` (React / React Native / Vue): the selected workspace from the shared cache, so an app needs no store copy.
  - Updating one workspace setting keeps the others (it replaced the whole settings object).

## 3.6.0

### Minor Changes

- 5f3355a: **A customer who paid with Stripe Link has a payment method on file.** `GET /billing/payment-method` reported cards only, so a customer whose saved method is Link (`type: 'link'`, no card details) saw "No card on file" right after paying, even though Link is what their subscription is charged with. The payment method is now reported for what it is:
  
  - `IPaymentMethodDTO` gains `type` (`'card'` | `'link'`) and `email` (the Link account's, for `'link'`; null for a card). A Link method has `brand: 'link'`, an empty `last4` and a 0 expiry. Show it as "Link · ana@acme.example". In `@fonderie/client` both fields are optional, because servers that predate them do not send them: treat an absent `type` as `'card'`.
  - Which method is shown: the consented id, then the customer's default (card or Link), then the newest card, then a saved Link method. A card is still preferred when there is no default.
  - A Link method carries no card fingerprint: for fraud composition it is a missing signal, never a clean one.
  - The prebuilt subscription screens (React and Vue) show "Link · email".

## 3.5.0

### Minor Changes

- f09da28: **A cold start opens screens on their last data.** `queries: { persist: { storage } }` (AsyncStorage, localStorage, or any `getItem`/`setItem` pair) keeps the shared read model on the device. After an app restart every screen shows what it showed last, at once, then refreshes it behind what is shown. Restored entries count as unconfirmed, so the first screen that asks refetches them even if they were saved a minute ago. `client.queries.hydrated` resolves once the snapshot is loaded, for an app that wants to hold its splash screen on it; hooks do not need to wait.
  
  Safe by construction, because the snapshot holds whatever the screens showed:
  - **Tied to the signed-in user**: the `sub` of the access token, decoded locally, never verified client-side. A snapshot loads only for the user who saved it. A token for a different user (signed in without a sign-out in between) wipes what the previous one saw before anything is shown. A token refresh for the same user keeps it.
  - **Wiped when the session ends**: sign-out, revocation and `clearCache()` empty the device copy as well as the screens. Nothing is saved or loaded without a signed-in user.
  - **Opt-in, with `filter(queryKey)`** to choose what may sit on the device (keys start with `GET /<path>`). For example, keep billing and workspace data but not customers' personal data.
  - **Bounded**: `maxEntries` (default 200, most recently confirmed first) and `maxAgeMs` (default 7 days). An answer fetched while the snapshot loads is never replaced by the saved one. An unreadable or malformed snapshot is ignored.

## 3.4.0

### Minor Changes

- 90963c4: **Customer, audit and webhook screens open on their data and follow a workspace switch.** `useCustomers` and the customer sub-resource hooks (emails, phones, addresses, notes, tags, relationships, labels), `useAuditEvents` and the webhook hooks loaded once per mount on a spinner. The selected-workspace reads among them never re-read after a switch. They now go through the client's shared store like the billing and workspaces hooks: data on the first frame when seen before, refreshes behind what is shown, no redraw when the answer is unchanged, a write under the same resource refreshes them everywhere, and a workspace switch reads the other workspace's entry without showing the previous one. Return shapes and `refresh({ force })` semantics are unchanged.
  
  - `@fonderie/react` / `@fonderie/vue`: `usePagedQuery(source, path, readFirst, readMore, opts)` for cursor- or offset-paginated lists. The first page is the cached read, and pages appended by `loadMore` belong to the exact first page they extend: an unchanged refresh keeps them, a changed first page re-anchors the list. `rethrowLoadMore: false` reports a failed page on `error` only. `customers` and `audit` use it, because their `loadMore` never threw. Vue `useScopedQuery` gains `enabled`, as React's already had.
  - `@fonderie/client`: `queryParams(params)`, a stable key fragment for a filter object (property order and undefined values do not change it).
  - Lists filtered by params (customers, audit) are keyed by the filters' content, so the same filters on two screens share one entry.

## 3.3.0

### Minor Changes

- ab62ea4: **Workspace screens open on their data, and follow a workspace switch.** `useMembers`, `useRoles`, `useInvitations`, `useWorkspaceSettings` and the other workspace reads loaded once on mount and never again. After the user switched workspace they kept showing the previous workspace's members and roles, and every visit opened on a spinner. They now read through the client's shared store (`client.queries`), like the billing hooks: data on the first frame when it was seen before, refreshes behind the data, no redraw when the answer is unchanged, and a workspace switch reads the other workspace's entry (instantly when seen before) without ever showing the previous one. Return shapes are unchanged.
  
  - `@fonderie/client`: the `workspaces`, `customers`, `audit` and `webhooks` sub-clients now report their scope, `getWorkspaceId()` and `onWorkspaceChange(listener)`, as `billing` already did. They held the workspace id silently, so no hook could follow a switch. Instances built without the constructor (test doubles) still work.
  - `@fonderie/react` / `@fonderie/vue`: `useScopedQuery(source, path, read, { normal, perWorkspace })`, the one read every hook package makes (keyed by path and, for per-workspace data, the selected workspace), plus `useWrite(after)` for the write → re-read → keep-the-error pattern, and `toApiError`.
  - `refresh({ force })` keeps its documented meaning in every migrated hook: it always re-reads, and `force: true` also bypasses the HTTP response cache. The billing hooks released in the previous version bypassed it on every `refresh()`; that is restored too.

## 3.2.0

### Minor Changes

- 157004a: **Screens open on their data, not on a spinner — and a refresh never flickers.** Every hook used to start each mount with no data and `isLoading: true`, then wait for the network, even for data the previous screen had just fetched. A refresh that came back with the same answer still replaced the screen's data. The client's response cache could not help: it honours the server's `Cache-Control`, and an API answering `max-age=0` is cached for 0 ms.
  
  - `@fonderie/client`: `client.queries`, one shared read model per client (`QueryStore`). Fetched answers can be read synchronously and are observed by every screen showing them. A fetch happens only when an answer is missing or older than `staleMs` (option `queries: { staleMs }`, default 5 minutes; `Infinity` = only when asked), or on an explicit refresh. A refresh never removes data, and an answer equal to what is shown keeps the same object. A failed refresh keeps the data and reports the error. A write marks the reads under its resource stale (the same fragments the HTTP cache evicts), so screens showing them refetch in the background. Sign-out and revocation clear it.
  - `@fonderie/react` / `@fonderie/vue`: `useClientQuery(source, key, fetcher)`, the one way a hook reads server data. `isLoading` means "nothing to show yet", never "a refresh is running" (that is `isFetching`). In Vue, requests wait for mount, so SSR never fetches.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: every read (`useSubscription`, `usePaymentMethod`, `useInvoices`, `useUsage`, `useWallet`, `useWalletTransactions`, `useWalletPreferences`, `usePlans`, `usePlan`) goes through it. Returning to a screen, or switching back to a workspace already seen, shows its data on the first frame with no request. `useWallet` and `useWalletPreferences` share one request. Pages loaded with `loadMore` survive a refresh that returns the same first page. Return shapes are unchanged. Two behaviour differences: a failed refresh now keeps the last data shown instead of clearing it, and `refresh()` always bypasses the HTTP cache.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

## 3.1.1

### Patch Changes

- c8157b2: **Rotating the integrity key no longer makes history look tampered.** The event log was verified against one key, so after a rotation every row signed before it failed: the `events.integrity` check reported authentic events as tampered. New `retiredIntegrityKeys` (on the `pg` transport config and `PGTransport`; `retiredKeys` on `startIntegrityCheck`): keys used to VERIFY older rows only, never to sign. Such rows are counted as `retiredKey` in the report, shown as advice (`EVENTS_RETIRED_KEY`), and never as tampered. A row that matches no key is still tampered: a retired key does not launder an edit.
  
  **No delivery is silently lost in limbo.** Claiming requires `attempts < maxRetries`, and only a handler that throws on its last attempt marked a row `dead`. A row whose last attempt never finished (the instance was killed mid-send) stayed `processing` forever: not retried, not dead, missing from both the dead-letter list and the backlog. Rows an older release reset to `failed` with spent attempts were stuck the same way. Each poll now marks those rows `dead`, with a recorded reason, once their lease has expired. Rows that still have attempts left are untouched.
  
  **Dead deliveries have a way out.** `PGTransport.retryDead(eventId, consumer)` gives a dead row a full set of attempts; `dismissDead(eventId, consumer)` retires it for good, keeping its error for the record. Migration `005_event_consumers_dismissed.sql` adds the `dismissed` status (additive). Operator routes, mounted by `@fonderie/admin`: `GET /_admin/events/dead`, `POST /_admin/events/dead/:eventId/:consumer/retry` and `…/dismiss`. Before this, a dead row kept the outbox check failing until someone edited the table by hand.

## 3.1.0

### Minor Changes

- 87f6e1d: **The invoice list no longer stops at 20.** `GET /billing/invoices` returned the newest 20 invoices and silently dropped everything older. It now pages newest first by keyset (`?limit=` 1–100, default 20; `?cursor=`) and answers `nextCursor`. `client.billing.listInvoices({ cursor, limit })`; `useInvoices()` gains `nextCursor`, `hasMore` and `loadMore()` (React and Vue), like `useWalletTransactions`. Providers receive an optional `createdLte` bound; one that ignores it still never repeats a row.
  
  **A usage screen can show the rate limit.** `GET /billing/usage/:metric` only summed usage records, so a windowed plan limit such as `'api-calls': { limit, window: '1d' }` — a counter, not records — always read 0. For such a metric it now answers from the live counter: `kind: 'counter'`, `total` used in the current window, `limit`, `status` (`ok` | `warning` | `over_limit` | `blocked`), `window`, `since` and `resetsAt`. Other metrics keep the records sum (`kind: 'records'`) and also report the plan's `limit`. `useUsage()` returns the whole reading as `usage` alongside `total` (React and Vue); `IUsageResult` is re-exported by the hook packages.
- 87f6e1d: **One free trial per owner, not per workspace.** With per-workspace billing every new workspace is a new subscriber, so the per-subscriber trial ledger let one person start a fresh trial in every workspace they created. New `config.trialScope: 'owner'` (default `'subscriber'`, today's behaviour): a workspace gets no trial when any workspace with the same owner has already had one. Needs the workspaces brick.
  
  **Checkout can decline the trial.** `POST /billing/checkout` accepts `skipTrial: true` (`ICheckoutInput.skipTrial` in `@fonderie/client`) for a paid checkout from day one — the retry an app offers after refusing a trial. It declines the trial for that checkout only; it never consumes it.
- 87f6e1d: **Billing screens follow a workspace switch.** With workspace billing the subscriber is the selected workspace, but the billing hooks only loaded on mount — a screen that stayed open across a switch kept showing the previous workspace's subscription, card, invoices or wallet.
  
  - `@fonderie/client`: `client.getWorkspaceId()` and `client.onWorkspaceChange(listener)` (returns an unsubscribe); the billing sub-client has the same pair. Listeners fire only when the id actually changes.
  - `@fonderie/react` / `@fonderie/vue`: `useWorkspaceId(source?)` — the current workspace id, re-rendering (React) or as a Ref (Vue) when it changes. Follows the provided client, or the sub-client you pass.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: `useSubscription`, `usePaymentMethod`, `useInvoices`, `useWallet`, `useWalletTransactions`, `useWalletPreferences` and `useUsage` clear what they showed and re-read on a switch, and a slow answer for the previous workspace can no longer land on top of the new one. `usePlans` / `usePlan` are not per-workspace and are unchanged.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

### Patch Changes

- 87f6e1d: **`workspace.plan` is marked deprecated.** The field is set to `'free'` when a workspace is created and nothing ever updates it — not a subscription, an upgrade or a cancellation — so an app reading it shows "free" for a paying workspace. It is now documented as such; read the workspace's subscription from `@fonderie/billing` (`GET /billing/subscription` with `X-Workspace-ID`, `useSubscription()` in the frontend packages). No behaviour change.

## 3.0.0

### Major Changes

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

## 2.5.0

### Minor Changes

- 3b6ca87: **A network failure no longer signs the user out.** Only the server refusing the session does.
  
  **Before:** any failed token refresh cleared the session and called `onAuthError()`. That included no signal, a 5xx and a rate limit, so a phone that was offline when its access token expired was signed out, even though nothing about the session had changed.
  
  **`@fonderie/client`:**
  - `client.session` is `'signedOut' | 'active' | 'offline' | 'revoked'`, and `onSessionChange(listener)` reports each change.
    - `offline` means signed in, but the server can't be reached. It goes back to `active` as soon as the server answers.
  - Only a 400, 401 or 403 from the refresh ends a session. Anything else keeps the tokens.
  - `onAuthError(info)` now says why the session ended:
    - `revoked`: announced live, with the server's reason in `detail`.
    - `expired`: the refresh was refused, with the reason code in `detail`.
    - `no-refresh-token`
    - Existing handlers that take no argument keep working.
  - `isSessionRefusal(err)` tells app code whether an error means "sign out" or "try again later".
  - `auth.hasAccessToken()` reports whether the client holds an access token.
  
  **`useSession` (React, React Native, Vue):** a failed session check signs out only when the server refused the session. Offline, the user stays signed in.
  
  `@fonderie/react` and `@fonderie/vue` re-export `SessionState` and `IAuthErrorInfo`, and the auth packages re-export `isSessionRefusal`, so apps keep a single import per package.

## 2.4.0

### Minor Changes

- d8eef38: Live sign-out (Phase 5 of `docs/SESSION-DESIGN.md`): when a session is revoked, the device holding it signs out **within a second**, not on its next request.
  
  - **Auth:** `fonderie.session.revoked` is declared in the event catalog. The audience is **only the user it's about**, and the event carries ids only: `{ sids, reason }`, where `sids: null` means every session. It's emitted when:
    - a device is signed out from the devices list (`terminated`);
    - all other devices are signed out (`terminated`);
    - the password changes (`password-changed`, all sessions);
    - an admin uses "sign out everywhere" (`admin`);
    - a refresh token is reused (`refresh-reuse`).
  - **Client:** while signed in, and when `sse` is configured, it listens on the stream it already holds. If the event names **this device's session** (its `sid`) or all sessions, it clears the tokens and cache and calls `auth.onAuthError`. Another device's revocation never signs this one out. Apps without `@fonderie/sse` see no change; `liveSignOut: false` turns it off.

## 2.3.0

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

## 2.2.1

### Patch Changes

- eb9a6d1: The signing secret can now be rotated **without signing anyone out**.
  
  **The incident:** on 2026-09-30, rotating `JWT_SECRET` invalidated every token at once. Phones kept showing signed-in screens with dead tokens, their live streams opened anonymously, and the next API call signed users out mid-use.
  
  **The fix:**
  - **Key IDs:** tokens now carry a key ID (`kid`, derived from the secret, so no extra config).
  - **Verification against previous keys:** verification picks the matching key among `[jwtSecret, ...jwtPreviousSecrets]`, so the old secret keeps verifying while its tokens age out. Tokens issued before this change, without a `kid`, are tried against each key. An unknown or mismatched `kid` is refused.
  - **Readiness:** a weak previous secret is an error, like a weak current one (`JWT_PREVIOUS_SECRET_WEAK`, translated for the console in en/fr/es; that's the client patch).
  - **Env:** `JWT_PREVIOUS_SECRETS` is declared in `env.json`.
  - **Docs:** the rotation runbook is in the README; the session roadmap is in `docs/SESSION-DESIGN.md`.

## 2.2.0

### Minor Changes

- a0a712e: The endpoint now decides how long clients may cache it, and the client obeys.
  
  **Why:** `@fonderie/client` cached every GET for its default lifetime and ignored the response's `Cache-Control`. `/config/public` already answered `no-store`, and it was cached anyway, one of the causes of a phone showing a stale screen switch. The endpoint knows how volatile its data is, so the client shouldn't guess.
  
  - **`withCache({ maxAge, scope? })` / `withCache(false)`**: in `@fonderie/core/middlewares`, plus a native Hono version in `@fonderie/adapter-hono`, sharing one header builder. It sets a standard `Cache-Control`: `private, max-age=N` by default, `public` for CDN-shareable data, `no-store` for `false`. A header the handler set itself is kept.
  - **The client honours `Cache-Control`**: `no-store`/`no-cache` → not cached; `max-age=N` → N seconds; otherwise the default TTL. An explicit per-call `cache` or `bust` still wins.

## 2.1.1

### Patch Changes

- d084dae: A config change event now invalidates the cached `/config/public` answer, so a pushed change is actually picked up. Apps keep their response cache.
  
  **The bug:** found on a phone. The change event arrived and the client re-read `/config/public`, but an app that passes a response cache (`new FonderieClient({ cache: createMemoryCache() })`) got the **old** value back from the cache. The load time moved; the value never did. Every test ran without a cache.
  
  **The fix:** `ConfigClient.load()` requests with `bust: true`. It skips any cached answer, fetches, and **stores the fresh one** in the cache. Readers never fetch: they read the client's snapshot. Upstream is asked only when an event says config changed, or when the stream reconnects.

## 2.1.0

### Minor Changes

- d9cb4ae: The live stream now reopens when the identity it was opened as changes: sign-in, sign-out, a different user, or a different workspace.
  
  **The bug:** the server decides what a stream may receive when the stream opens. A stream opened at app start, before sign-in, stayed **anonymous** for its whole life. Config still arrived, but every workspace or user event was withheld from it. Found in production, where a signed-in phone's stream was logged as `user=anonymous`.
  
  **The fix:** `TokenStore` now announces changes (`onChange`), and `SseClient` compares the identity it's connected with (the token's user, from its `sub` claim, plus the workspace) and reconnects only when that changes. A silent token refresh for the same user doesn't reconnect. `FonderieClient.setWorkspaceId` also triggers the check. New public method: `client.sse.identityChanged()`.

## 2.0.0

### Major Changes

- 68393a7: Remote config has one read path, and it is always live.
  
  **The problem:** there were seven ways to read remote config. Reactivity was opt-in everywhere, and the one keyed API, `useFlag`, loaded once and never updated. Apps added polling on top, plus their own persisted copies for offline starts.
  
  **Now:**
  
  - **`useRemoteConfig(key, fallback)`** (React and Vue) reads one key. It re-renders only when that key's value changes. The first mounted reader opens the shared `@fonderie/sse` stream and loads; the last one closes it. There is no polling and nothing to opt into. Every (re)connect re-reads, so changes missed while the stream was down still arrive.
  - **`withRemoteConfig(key, Component, { off, fallback })`** (React and Vue) renders a screen only while a switch is on, and `off` (for example "coming soon") otherwise. It flips live. "On" is decided by the new **`isSwitchOn(value)`**: the console stores what the operator typed, so `false`, `0`, `''` and the strings `false`, `off`, `0` and `no` (any case, trimmed) are all off. Plain truthiness would have kept a screen switched to `"false"` visible.
  - **`new FonderieClient({ config: { storage } })`** keeps the last answer on the device (AsyncStorage, localStorage) and restores it before the first render. Hold that render on `client.config.ready`. A cold start with no signal decides from last-known values.
  - **A key the server does not expose warns once** (usually a typo, or a key missing from `publicKeys`), through the new client `log` option (default `console`). Stream-unavailable warnings go through `log` too.
  
  **Breaking:**
  
  - Removed: `useFlag`, `useRemoteConfig({ refreshMs, watch })`, `IUseRemoteConfigOptions`/`IUseRemoteConfigReturn`, `client.config.watch()` and `client.config.hydrate()`.
  - Migrate `useFlag(k, f)` to `useRemoteConfig(k, f)`, and a screen gate to `withRemoteConfig`. Replace app-side config persistence with `config.storage`.
  - `ConfigClient.retain()` is the ref-counted engine behind the bindings; apps don't call it.

## 1.16.0

### Minor Changes

- 6a2bb86: New option `new FonderieClient({ sse: { baseUrl } })` serves the Server-Sent Events stream from a different host than the API. A serverless API can't hold streams open, so they're often served by a separate long-running host, for example `stream.example.com` next to `api.example.com`. Only `/sse/stream` goes to that host; every other request still uses `baseUrl`.

## 1.15.0

### Minor Changes

- 72f93d7: Client side of realtime delivery, step 5 of `docs/REALTIME-DESIGN.md`.
  
  **`@fonderie/client`:**
  - `client.sse.subscribe(topics, onEvent, { onReset })` receives events from `@fonderie/sse`.
    - It opens **one shared connection** per client, on the union of every subscription's topics.
    - It sends the auth and workspace headers, and refreshes an expired token once on a 401.
    - It reconnects with backoff, and fires `onReset` on every (re)connect so callers refetch.
    - `pause()` and `resume()` are for backgrounding.
    - `status` is `'unavailable'` when the server has no SSE route or the runtime's fetch cannot stream, and nothing breaks: polling carries on. React Native passes Expo's fetch as `new FonderieClient({ sse: { fetch } })`.
  - `client.config.hydrate(values)` seeds the snapshot from values the app saved on the device, before the first render, so a cold start with no signal still decides correctly. A load from this session always wins over it.
  - `client.config.watch()` re-reads `/config/public` on `fonderie.config.changed` and on each reconnect. It is reference-counted.
  
  **`@fonderie/react` and `@fonderie/vue`:**
  - New `useSse(topics, onEvent, { onReset })`.
  - New `useSseStatus()` reports the shared connection's state, for a "live" indicator; never gate rendering on it.
  - `useRemoteConfig({ watch: true })` watches while the component is mounted.
  - The `useFlag` docs no longer tell you to fall back to "off" when gating a whole screen: a screen must never be unavailable because there is no signal.

## 1.14.1

### Patch Changes

- 8dd41f4: Console dictionaries (en/fr/es) gain the sentences for billing's `WEBHOOK_SECRET_MISSING` and `WALLET_WEBHOOK_SECRET_MISSING` and events' `WEAK_INTEGRITY_KEY`.

## 1.14.0

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

## 1.13.0

### Minor Changes

- 1b349ba: The console shows every email and every language it exists in — Fonderie's built-in copy included.
  
  - **courier** — `GET /admin/template-catalog`: every email (saved or built-in only) with its built-in languages and saved versions, plus the app's system locale and fallback chains. The flat list only had saved rows, so a built-in email nobody had edited — every billing email — was invisible and could not be edited from the console. `GET /admin/templates/:type/built-in?locale=` returns Fonderie's copy in a language; `GET /admin/templates/:type/resolve?locale=` answers "who receives what" with the same function a real send runs (`chooseCopy`), so the console cannot disagree with delivery.
  - **client / hooks** — `getTemplateCatalog`, `getBuiltInTemplate`, `resolveTemplate`; `useTemplateCatalog`, `useBuiltInTemplate`, `useTemplateResolution` (React and Vue); `templateLanguages` / `suggestTemplateLocales` shared by both consoles. `useTemplate` now clears the shown version on a 404 instead of keeping a deleted one on screen.
  - **screens / admin** — the list is one row per email with an aligned language column sorted by code, the default version labelled with the system locale (`en-US`); solid = a version you saved, dashed = Fonderie's built-in copy. A built-in language opens prefilled and saving creates your version; "Reset to built-in" returns a language to Fonderie's copy (and the default version to its built-in text, as a new version). The editor shows the fallback chain and a "who receives what" check; adding the system locale is refused. `TemplateListScreen`'s selection callback now receives `{ type, locale, system }` rather than a full stored row, since a built-in email may have none.

## 1.12.0

### Minor Changes

- 973faad: Built-in emails in English, French and Spanish, and locale fallback chains the app declares once.
  
  - **core** — `locales: { default, fallbacks }` in the app config: the system locale (default `en-US`) and, per market or language, where content comes from when that market has none (`fr: 'fr-CA'`, `'fr-BE': ['fr-FR', 'fr-CA']`). Chains don't expand, so a market's path reads in one line. A bad chain (invalid tag, a locale falling back to itself, more than five fallbacks) stops the app at construction. New: `defineLocales`, `localeChain`, `canonicalLocale`, `app.locales`, plus `withTranslations` / `translationProblems` for modules shipping translated defaults.
  - **courier** — resolution order: the app's saved versions along the chain, then the built-in copy by language, then the saved default, then the built-in English. The system locale comes last so a French user gets the shipped French rather than the app's English default. The built-in layout shell is drawn in the email's language. Every send records the version actually used (`fonderie_message_log.resolved_locale`, migration 005 — run migrations with this release; until then sends still work and only that detail is skipped). Template tags are stored canonical, and a version tagged with the system locale is refused (409 `DEFAULT_LOCALE`): the default copy already is that version.
  - **auth / billing / workspaces** — every built-in email ships in French and Spanish, with a coverage test that fails when a translation's subject, text or html uses different `{{variables}}` than the English.
  - **auth / client** — sign-up accepts `locale`, stored on the new account, so the verification email already arrives in it; without one, new accounts get the app's system locale instead of a hard-coded `en-US`.

## 1.11.1

### Patch Changes

- 6acfb5b: Adding a locale or a new template now has the same live preview as the editor, and flags fields still identical to the default copy ("Still the default copy: Subject, Plain-text body") — a half-translated email looked finished in a textarea and only showed its English subject once sent. The console page now loads its script as `app.js?v=<version>`, so a page opened after a deploy never reuses the previous bundle from cache.

## 1.11.0

### Minor Changes

- 585fa8b: Email templates show their locales. The template list is one row per email with a chip for each locale it exists in (inactive ones struck through), instead of one flat row per (type, locale) pair that left an operator guessing which translations exist. The editor has a tab per locale: switching asks before discarding unsaved edits, and "+ Add locale" is offered on every locale and suggests the locales the app already uses elsewhere that this email lacks. New in `@fonderie/client`: `groupTemplatesByType` and `missingTemplateLocales`, shared by the React and Vue screens. `TemplateEditorScreen` gains `onSelectLocale` (Vue: `localeTabs` + `select-locale`); `onAddLocale` / `add-locale` now also receive `{ locales }`.

## 1.10.0

### Minor Changes

- 49c6c78: `LocaleMap<T>` — a read-only map with one value per console language. `adminLocaleNames` and `adminLocaleTags` are typed with it and frozen at runtime: they are shared by every console on a page, so an embedding app can no longer rename a language for everyone by assignment. Their published signatures now read `LocaleMap<string>` instead of the expanded object type.

## 1.9.0

### Minor Changes

- b94ed53: The admin console speaks English, French and Spanish.
  
  The console's language is the OPERATOR's preference, independent of the locales the app serves its customers — a founder in France can run the console in French while every customer email stays English. It defaults to the browser's language, is stored per browser (`fonderie.admin.locale`), and is switched from the sidebar footer: a Language row with a menu (English / Français / Español, a check on the current one) above a Theme row with an icon-only System / Light / Dark control. The sign-in and onboarding screens carry the same controls, and a French or Spanish browser gets them in its language from the first screen.
  
  - `@fonderie/client`: `createAdminT(locale)`, `formatAdminDate`, `detectAdminLocale`, `ADMIN_LOCALES`, `adminLocaleNames` and the dictionaries — English canonical, French and Spanish typed against it, so a missing or extra key is a compile error; a test also checks every translation is non-empty and keeps the same `{placeholders}`.
  - Every console screen (React and Vue) takes an optional `locale` prop — `uiLocale` on `TemplateEditorScreen`, whose `locale` is the template's — and `AdminShell` passes it down. Omitted ⇒ English, so embedding apps are unaffected.
  - Dates follow the console language. Sign-in errors from known server reasons are shown translated; other server messages (check findings, validation from the API) stay as the server sends them.

## 1.8.0

### Minor Changes

- 1a593bc: The admin console now does what the CLI does for config, secrets and templates — and no longer edits the wrong row.
  
  **Fixed — the console could act on a different row than the one clicked:**
  - Opening a config entry or secret dropped its environment: a production-only row opened (and saved over) the shared `all` value.
  - Revealing a secret revealed the list's scope, not the row's environment.
  - Opening a template dropped its locale: the French row opened, and saved, the default copy.
  - `@fonderie/store`: re-creating a key that had been deleted failed with a 500 — the new version 1 collided with the key's surviving revision history. It now continues after the last revision; history is kept.
  
  **New, matching the CLI:**
  - Delete for config, secrets and templates (behind the fresh-code prompt).
  - **Built-in emails cannot be deleted.** `@fonderie/courier` refuses to delete the default-locale row of a seeded or module-shipped template (409 `SYSTEM_TEMPLATE`) and marks those rows `system: true` in the list — they can be edited and rolled back only. Locale variants and app-added templates remain deletable. A test pins the seeded list to migration 002.
  - Environments: filter Config & secrets by environment; create an entry in a chosen environment.
  - Templates: "New template", and "Add locale" on a template (starts from the default copy).
  - Version checks on the config and template editors: a concurrent change shows a conflict with Reload instead of being overwritten.
  - Public config: keys served to frontends are marked "public", with a preview of exactly what `GET /config/public` returns.
  - Audit: from/to date filters. Billing: read a subscriber's wallet in another currency.

## 1.7.0

### Minor Changes

- 2c350b5: Deleting an account now stops its billing, and purging it erases the payment provider's copy.
  
  Before: `@fonderie/auth` soft-deleted the user and emitted `fonderie.user.deleted`, but nothing listened — an active subscription kept renewing on a card the person could no longer sign in to cancel.
  
  - **Billing, on `fonderie.user.deleted`** (needs the event bus): cancels the user's subscription at the provider — immediately by default; `onSubscriberDeleted: 'cancel-at-period-end' | 'keep'` to change that — and disarms off-session charging (auto-recharge off, stored card and any pending recharge key forgotten). No automatic refund; the app decides. Workspace subscriptions are untouched. Idempotent: an "already canceled" answer from the provider is success, a real failure throws so the bus redelivers.
  - **Billing, on `fonderie.user.purged`:** deletes every provider customer record the user had (subscription and wallet customers) — the email and saved cards. The provider keeps its invoices; local subscriptions, ledger and balances stay as financial records keyed by an id that no longer resolves to a person. New optional provider method `deleteCustomer` (Stripe: `customers.del`, already-deleted is a no-op).
  - **Auth:** `purgeSoftDeletedUsers` / `startUserRetention` take an optional `bus` and emit `fonderie.user.purged` { userId } for each hard-deleted account, after the delete. `EVENT_KEYS.userPurged`. The admin user lookup by id resolves soft-deleted accounts (with `deletedAt`); `GET /_admin/users?deleted=1` lists only them.
  - **Client / hooks:** `listUsers({ deleted: true })`; `useAdminUsers` passes it through.
  - **Console:** Users gets an Active / Deleted switch; a deleted account shows "Deleted on …" instead of account actions, sessions and sign-ins, and keeps its Plan & credits.

## 1.6.0

### Minor Changes

- 431aa20: Operator accounts for the admin console: people sign in with email, password and a mandatory authenticator app instead of pasting a token.
  
  A token is a shared secret with no name on it — pasted into chat, saved in notes, logged as "admin-token". With a `store`, `@fonderie/admin` now has operators:
  
  - **No registration.** The first operator is claimed once with the root `adminToken`; every other one is invited by an Owner through a single-use, expiring link. Operators live in their own table — an app sign-up or an app account takeover can never produce one.
  - **Mandatory second factor.** RFC 6238 codes with a replay guard, QR enrollment, ten single-use backup codes shown once. Secrets sealed at rest with the new `operatorKey` (64 hex).
  - **Step-up.** Revealing a secret, minting a token or link, applying a migration and deleting need a code from the last five minutes; the console prompts and retries the action.
  - **Sessions.** HttpOnly SameSite=Strict cookie (`__Host-` over HTTPS), 30 min idle / 12 h absolute, rotated at every privilege change, same-origin writes only. Lockout after 5 failures plus a per-address limit; generic errors.
  - **Recovery without email.** Backup codes, a recovery link from another Owner, or the root token from the terminal (`fonderie admin operator recover <email>`) as the break-glass.
  
  `adminToken` remains the machine credential and the break-glass. `operators: false` keeps the token gate. New client methods on `AdminClient` (`session`, `login`, `verify`, `stepUp`, `inviteOperator`, …, and `adminToken` is now optional for cookie use), hooks `useAdminSession` / `useAdminOperators` (React and Vue), an Operators page in both screen packages, and `fonderie admin operator invite|recover|disable|enable`.

## 1.5.0

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

## 1.4.0

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

## 1.3.0

### Minor Changes

- cc51775: Admin editors that respect the operator's time.
  
  - **Templates:** the preview sits to the right of the editor and stays pinned
    while the form scrolls (it used to wrap below the fold), and it is always
    live — re-rendered 500 ms after the last edit instead of on a Render click.
    Save is disabled with "No changes to save" until the content differs from
    what is stored.
  - **Config & secrets:** the page had no way to create an entry and rendered
    bare headings when empty. It now has an empty state and **New entry** /
    **New secret** buttons; creating refuses an existing key rather than
    overwriting it. Values are edited by type — Text, Number, On/off or JSON —
    instead of raw JSON, and a value that does not parse shows why (it used to
    fail silently). The list shows each entry's type and value.
  - **client:** `castConfigValue`, `configValueType`, `formatConfigValue`,
    `configKeyProblem` and `CONFIG_VALUE_TYPES` — the typed-value rules the
    editors use, shared so feature-flag hooks can use the same casting.

## 1.2.0

### Minor Changes

- cb2ea60: Locations carry `geonameId` — MaxMind/GeoNames' stable, language-neutral key
  for the place resolved. Stored names are a snapshot in one language; the id
  lets any reader see a login's place in their own language later, and lets an
  app map places onto its own regions (markets, provinces, pricing zones).
  `PostgresGeoProvider` returns it from the City block; `geoFromHeaders` returns
  `null` (platforms send names, not a key). Auth sanitizes it to a positive
  32-bit integer, accepting node-pg's BIGINT-as-string.

## 1.1.0

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

## 1.0.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.

## 1.0.0

### Major Changes

- 70e74b4: **Breaking:** the admin console's config report is now the *environment* report.
  
  `@fonderie/admin` registered `GET /_admin/config` for a payload that has never
  been configuration: readiness problems per module, and which **declared env
  vars are set**. That is a deployment report.
  
  Holding the name had two costs.
  
  `@fonderie/config` describes `GET /_admin/config` for real config entries, so
  registering both modules **failed boot outright**, in either order:
  `[fonderie] @fonderie/config cannot describe GET /_admin/config`. The config
  brick could not be used alongside the admin console at all — its "Config &
  secrets" page was unreachable by construction.
  
  The misnomer also caused a production crash. The served UI probed `/config` to
  decide whether the config brick was mounted; because admin owned that path the
  probe was true on every deployment, so the shell built a `ConfigAdminClient`
  whose `listConfig()` received admin's report *object* where it expected an
  *array*, and the page died on `entries.map(...)`.
  
  | before | after |
  |---|---|
  | `GET /_admin/config` | `GET /_admin/environment` |
  | `AdminClient.config()` | `AdminClient.environment()` |
  | `useAdminConfig` | `useAdminEnvironment` |
  | `IUseAdminConfigReturn` | `IUseAdminEnvironmentReturn` |
  | `ConfigScreen` / `IConfigScreenProps` | `EnvironmentScreen` / `IEnvironmentScreenProps` |
  | `IAdminConfigReport` | `IAdminEnvironmentReport` |
  | `AdminPage` member `'config'` | `'environment'` |
  | nav label "Configuration" | "Environment" |
  
  No deprecation alias is possible: freeing the path *is* the fix, so serving it
  under both names would preserve the collision.
  
  `@fonderie/config` and its screens packages are unchanged — they keep
  `/_admin/config` and `/_admin/secrets`, which is the point.
  
  Migration is a rename. If you called `AdminClient.config()`, call
  `.environment()`; if you imported `useAdminConfig` or `ConfigScreen`, import the
  `Environment` names. Nothing in this repo's examples used any of them.

## 0.31.0

### Minor Changes

- 5e5cc5c: Apply pending migrations from the admin panel, per module, additive only
  
  The surface could already say a module was behind — the `app.migrations` check
  has reported it on the doctor and attention pages since the panel shipped. It
  could not do anything about it: applying meant `npm run migrate` from somebody's
  laptop, which is exactly the production DDL-by-hand this surface exists to
  replace.
  
  `GET /_admin/migrations` now reports every module's pending files **with their
  impact**, and `POST /_admin/migrations/:module/apply` applies one — all of its
  pending migrations, or none.
  
  **It refuses anything that deletes data.** `classifyMigration` labels each
  pending file; a module holding a `DROP`, `TRUNCATE` or `ALTER COLUMN … TYPE` is
  not appliable here and the panel names the offending statement and says to use
  CI or `npm run migrate` instead. There is no override — dropping a column should
  not be one click behind an admin token.
  
  **It refuses out of order.** Migration order is the app's, declared in one
  constant, and sets depend on each other across it — auth owns `fonderie_users`,
  which app migrations extend. A module sitting behind an unapplied one reports
  `blockedBy` and says which to apply first, so the operator walks the declared
  order and the UI cannot construct an out-of-order apply.
  
  **It refuses a set that changed under you.** The request carries the pending
  filenames the operator was shown; if a deploy has since changed them, the server
  answers 409 rather than applying something nobody reviewed.
  
  **It never reports an outcome it did not re-read.** Each migration commits in
  its own transaction, so a request that dies partway really did apply some files.
  The handler re-reads after `run()`, and the hooks refresh after a failure as
  well as a success — a timeout and a refusal must not look alike.
  
  A first install is exempt from the destructive rule: with no
  `fonderie_migrations` rows there is nothing to lose, the same judgement the CLI's
  `migrate --check` makes.
  
  Opt in by passing your migration sequence: `new AdminModule({ …, migrations:
  MIGRATION_STEPS })`. Without it the routes are not registered — this surface
  must never infer an order the app owns.

## 0.30.0

### Minor Changes

- 2530bf1: Preview a template beside the editor, rendered the way it will actually send
  
  The editor was three textareas. You changed HTML and saved it blind; the first
  render anyone saw was in a recipient's inbox.
  
  `POST /admin/templates/:type/preview` renders what the editor is **holding**,
  not what is stored, so you see the change before committing it. It goes through
  `renderFragment` and the operator's own `_layout` row, because a fragment
  rendered without the shell looks nothing like the mail that sends — and a
  preview that lies is worse than none.
  
  Three things had to become reachable for that to be true:
  
  - `getLayoutHtml(store, locale?)` is now exported. The `_layout` lookup was
    private to `DBTemplateResolver`, so nothing outside could fetch the shell.
    The resolver now calls the same function — one definition, not a copy.
  - `describeTemplateAdminRoutes` / `buildTemplateAdminRoutes` take an optional
    `{ brandName }`. On a real send the **Dispatcher** merges it, never the
    resolver, so a preview without it silently renders the wrong brand.
  - `templateVariables()` is exported, and the preview reports the variables the
    submitted content uses. The editor seeds its sample-data box from that rather
    than re-implementing the `{{var}}` contract — four copies of that regex
    already exist in this repo, and a fifth on the client would drift.
  
  The `{{var}}` and `{{#section}}` patterns are now named constants shared by the
  renderer and the new extractor, so substitution and "which variables is this?"
  cannot disagree.
  
  The preview renders into `<iframe sandbox="">` — no scripts, no same-origin.
  Operator-authored HTML must never execute in the dashboard's origin, which is
  where the admin token lives.
  
  Being a POST, the route requires the `write` scope rather than `read`. That
  follows the rule that scope comes from the route and is never annotated, and
  costs nothing in practice: anyone in the editor already needs `write` to save.
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
- 3bf1669: The Subscriber page lists on arrival instead of asking for a type and an id
  
  `GET /_admin/subscriptions` returns a keyset-paginated page of subscribers,
  newest first — `{ subscriptions, nextCursor }`, the same cursor contract as the
  wallet ledger. The existing `/subscriptions/:type/:id` lookup is unchanged.
  
  The screen opened as an empty form asking for a subscriber type and id, which
  is answerable only if you already knew both. Now it lists, and a row opens the
  detail view — subscription, wallet, ledger and the manual grant — exactly as
  before.
  
  `limit` is clamped strictly (`NaN`, `<1` or `>100` ⇒ 422) and a malformed
  cursor is 422, matching how the wallet ledger behaves in this package rather
  than auth's and audit's silent clamp.
  
  Includes an index on `fonderie_subscriptions (created_at DESC, id DESC)` —
  **run the billing migrations**. The table carried no index at all: every read
  so far was by subscriber, which a small mirror serves from a scan, but a keyset
  page is a range scan and would otherwise sort the whole table each time.
  
  Ships `BillingAdminClient.listSubscriptions()`, `useAdminSubscribers` for React
  and Vue, and both Subscriber screens listing with Load more.

## 0.29.2

### Patch Changes

- 7299a08: `host` — answer only for requests addressed to a hostname you name
  
  `AdminModule({ host: 'admin.example.com' })`, or a list. Every other host
  gets the same `404` an unmounted surface gives — deliberately not a `403`,
  which would confirm the surface exists and that you found the wrong door.
  Case-insensitive, port-optional unless you configure one, and it covers the
  served dashboard's two unguarded asset routes as well: serving a page that
  says "admin" on your public API hostname is precisely what this prevents.
  
  The concrete reason it exists: platforms hand every deployment a permanent
  URL of their own (`project-abc123.vercel.app`) that answers whatever your
  custom domain answers, walking around anything you put in front of the
  domain. Binding closes that hole while the rest of the app keeps serving on
  both hostnames.
  
  **It is not an access control**, and the option's doc comment says so.
  `Host` is client-set, so this only means something when the edge decides the
  hostname and your origin is not reachable around it — the same footgun
  `trustProxy` carries in `@fonderie/core`. A refused request is still logged,
  so the caller learns nothing and the operator learns something, and the
  manifest reports the binding as `admin.host` (client type updated to match).

## 0.29.1

### Patch Changes

- 38f2410: Use one definition of a request path
  
  `@fonderie/media` recovered the app's `basePath` by stripping `/media` off
  the request path, which a trailing slash defeated — `/v1/media/` yielded no
  basePath and the served URL came out wrong. It now normalizes first.
  `@fonderie/logger` logs the normalized path, so `/x` and `/x/` group as one
  route. `@fonderie/client`'s six admin clients shared six copies of the same
  prefix strip; now one, kept local because this package has zero runtime
  dependencies by design.

## 0.29.0

### Minor Changes

- db925e5: `AdminClient.issueToken()` and `.revokeToken()`
  
  The root-token-only writes behind `@fonderie/admin`'s scoped tokens, with
  `AdminScope`, `IAdminTokenRecord`, `IAdminIssueTokenInput` and
  `IAdminIssuedToken` (the plaintext, returned once). `IAdminTokensReport`
  gains `issued` — null when the deployment gave `AdminModule` no store.

## 0.28.0

### Minor Changes

- 0ea4938: `AuditAdminClient` — `@fonderie/audit`'s operator read, typed
  
  `listAudit({ workspaceId?, type?, actorId?, from?, to?, limit?, cursor? })`
  — every workspace unless one is named, the workspace-scoped `IAuditPageResult`
  shape. Same constructor as the other admin clients, `prefix` included.

## 0.27.0

### Minor Changes

- 3e069c9: `BillingAdminClient` — `@fonderie/billing`'s operator routes, typed
  
  `catalog()`, `createPlan()`, `updatePlan()`, `deletePlan()`,
  `subscription(type, id)`, `wallet(type, id, currency?)`,
  `walletLedger(type, id, { currency, limit, cursor })`, `grant(input)` —
  with `IAdminCatalog`, `IAdminSubscriptionDTO`, `IAdminWalletDTO`,
  `IAdminWalletLedgerPage`, `IAdminPlanInput`, `IAdminGrantInput`. Same
  constructor as the other admin clients, `prefix` included.

## 0.26.0

### Minor Changes

- 201f6af: `AuthAdminClient` — `@fonderie/auth`'s operator routes, typed
  
  `findUser(email)`, `getUser(id)`, `listUserSessions(id)`,
  `revokeUserSessions(id)`, `userLoginHistory(id, { limit, cursor })`,
  `suspendUser(id)`, `unsuspendUser(id)`, with `IAdminUserDTO` (the app's
  user DTO plus `deletedAt`). Same constructor as `AdminClient`, including
  `prefix`. Not on `FonderieClient`: no user session reaches these.

## 0.25.0

### Minor Changes

- fdae8f5: `prefix` on `ConfigAdminClient` and `CourierAdminClient` — reach the composed surface with the one token
  
  `new ConfigAdminClient({ baseUrl, adminToken, prefix: '/_admin' })` sends
  `/_admin/config…` instead of the brick's standalone `/admin/config…`, so the
  config, secrets and template screens can sit inside the admin shell behind
  `@fonderie/admin`'s token. Unset keeps today's paths. The path literals are
  unchanged in source; the prefix replaces the leading `/admin` at request
  time.

## 0.24.0

### Minor Changes

- e8eb04c: `AdminClient` — the operator's surface, typed
  
  `new AdminClient({ baseUrl, adminToken, prefix = '/_admin', actor? })` with
  `attention()`, `manifest()`, `doctor()`, `config()`, `routes()`, `tokens()`
  and `adminLog({ limit, before })`, plus the page types. Deliberately not on
  `FonderieClient`: no user session can reach this surface. `prefix` follows
  the app when it moved the surface.

## 0.23.0

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

## 0.22.0

### Minor Changes

- fd87133: Add `GET /auth/providers` — which sign-in methods this deployment can actually honour.
  
  A login screen has to decide which buttons to draw, and the only honest source is the side holding the credentials. The alternative is a build-time flag in the frontend, which stores the same fact twice and lets the two disagree: the app offers a provider the server cannot complete, and the user lands on the provider's error page, which the app has no way to explain.
  
  Returns exactly `{ providers: [...] }` from the module's own config — nothing else. Public and unauthenticated on purpose, because the login screen needs it before anyone has signed in; it discloses nothing a visitor could not learn by looking at the buttons, and specifically no client ids, redirect URIs, or module inventory.
  
  Apps were hand-writing this. Doing so means re-reading the same environment variables auth already reads, in a second place, with a second chance to disagree — and naming it `/config`, which collides conceptually with `@fonderie/config` (operator-set feature flags and secrets, a different thing entirely).
  
  Overridable through `config.routes.providers` like every other auth route.
  
  Ships with the whole path, because a route a frontend cannot reach is not a feature: `client.auth.providers()` on the typed client, `useAuthProviders()` in react-auth, and the matching composable in vue-auth (react-native-auth re-exports react-auth's).
  
  Both hooks start EMPTY rather than optimistic, and fall back to empty on error. A brief moment with no social buttons is invisible; a button that appears and then fails is not — and an unreachable API is not evidence that Google works.

## 0.21.0

### Minor Changes

- 048138e: Native Sign in with Apple in the SDK.
  
  - `@fonderie/client`: `client.auth.appleNative({ identityToken, nonce? })` posts a
    native Apple `identityToken` to `POST /auth/apple/native` and returns the same
    `{ tokens, user }` envelope as `login` (no MFA branch). New `IAppleNativeInput`
    type.
  - `@fonderie/react-native-auth`: `useAppleSignIn()` — mirrors `useLogin`: call
    `signIn({ identityToken, nonce? })` with the token from the native Apple sheet
    (e.g. `expo-apple-authentication`) and it stores/persists the session token.
    Exposes `isLoading` / `error` / `data`.
  
  The framework stays free of any native Apple dependency: the app obtains the
  `identityToken` (its choice of native module) and hands it to the hook. Requires
  the API to enable the provider (`@fonderie/auth` `providers: ['apple']`).

## 0.20.0

### Minor Changes

- 3039084: Distributed tracing via W3C Trace Context — the Phase-1 correlation id becomes a
  real trace you can send to Jaeger/Tempo/Datadog-APM/Grafana, with **no required
  deps**.
  
  - `@fonderie/logger`: the request middleware now continues an inbound
    `traceparent` (the upstream span becomes the parent of a fresh server span) or
    starts a new trace, puts `traceId`/`spanId` on `ctx.meta` and the logs, and
    **echoes `traceparent`**. New dep-free helpers (`parseTraceparent`,
    `formatTraceparent`, `newTraceContext`) and an `ITraceExporter` seam with two
    exporters that need no SDK: `ConsoleTraceExporter` (JSON spans → stdout,
    self-hosted default) and `OtlpHttpTraceExporter` (a plain OTLP/HTTP POST that
    works with any OTLP collector). Wire one via `LoggerModule({ traceExporter })`;
    omit it and the trace context still propagates and shows in the logs.
  - `@fonderie/client`: sends `traceparent` on every request (portable random ids
    for RN/Hermes) with `X-Request-ID` unified to the trace id, so
    `FonderieApiError.requestId` is the trace id.
  
  `traceparent` is the standardized header (W3C Trace Context; `X-` prefixes are
  deprecated per RFC 6648), so traces interoperate with every OTel-compatible tool.
  Trace/span ids are random + pseudonymous — metadata-only, same posture as Phase 1.

## 0.19.0

### Minor Changes

- 9e880d1: Request correlation, end-to-end (telemetry Phase 1). The logger's request
  middleware now honours an inbound `X-Request-ID` (client or load balancer) when
  it's a bounded, safe token, generates one only if absent/unsafe, and **echoes it
  in the response header** — so a single id threads the client call → server logs →
  audit trail and can be quoted in a bug report. `@fonderie/client` sends
  `X-Request-ID` on every request (uuid where available, a portable fallback for
  React Native/Hermes) and surfaces it on `FonderieApiError.requestId`.
  Metadata-only and pseudonymous — no payloads captured; IP-minimization policy and
  retention are separate follow-ups.

## 0.18.0

### Minor Changes

- 31f26fb: Add a `media` sub-client for image/avatar upload — `client.media` alongside
  `client.auth`/`client.billing`, sharing the same access token. Methods:
  `upload({ dataBase64, purpose? })` (POST /media), `delete(id)` (DELETE
  /media/:id), plus the pure helpers `assetUrl(id)` (absolute `<img src>` for the
  public GET /media/:id) and `assetIdFromUrl(url)` (its inverse, for avatar
  cleanup). Completes the frontend surface for the @fonderie/media brick, which
  until now shipped server-first — the new @fonderie/react-media,
  @fonderie/react-native-media, and @fonderie/vue-media hook packages build on it.

## 0.17.1

### Patch Changes

- be7a6e7: URL-encode every path parameter uniformly. Path segments were interpolated raw in most modules (only a few call sites encoded), so an id containing `/`, `?`, or `#` — e.g. user-influenced input an app forwards as an id — could rewrite the request target. All path-segment interpolations now go through `encodeURIComponent`; query-string fragments are unchanged.

## 0.17.0

### Minor Changes

- 4eff0f5: Idempotent subscription checkout. `POST /billing/checkout` now accepts an optional `idempotencyKey` (added to `checkoutSchema` so `validate` doesn't strip it, threaded into `StripeProvider.createCheckoutSession` as the Stripe idempotency key). `@fonderie/client`'s `ICheckoutInput` gains the field, and `@fonderie/react-billing`'s `useCheckout` generates a V4 UUID per attempt (mirroring `usePurchasePack`) — so a retried checkout dedupes to a single session (and one subscription) instead of a duplicate. Verified: same key → same Stripe session; different key → different session.

## 0.16.0

### Minor Changes

- afb418c: Read/manage APIs for login activity. `@fonderie/auth` adds four caller-scoped routes: `GET /auth/login-history` (the caller's own attempts, newest first, keyset-paginated on `(created_at, id)` — the same cursor contract as audit's event log, reused from `@fonderie/core`); `GET /auth/sessions` (live sessions, with the current one flagged via the request's `sid`); `DELETE /auth/sessions/:id` (revoke one session, scoped to its owner); and `DELETE /auth/sessions/others` (revoke every session except the current). Because access tokens are already bound to their session's `sid`, terminating a session revokes its access token on the next request, not just its refresh. `@fonderie/client`'s `AuthClient` gains `getLoginHistory`, `listSessions`, `terminateSession`, and `terminateOtherSessions`, sharing the existing auth token.

## 0.15.1

### Patch Changes

- ad8c072: `IInvoiceDTO` now carries `dueDate` (ISO-8601, or null). `GET /billing/invoices` surfaces each invoice's payment-terms due date from the provider (`StripeProvider` maps `invoice.due_date`); one-time charges are paid on capture and carry `null`. Lets a billing UI show a "Due" column alongside the payment date.

## 0.15.0

### Minor Changes

- 158555a: Add the in-app pack-purchase surface for `@fonderie/billing`'s `POST /billing/wallet/purchase`.
  
  - `@fonderie/client`: `billing.purchaseWalletPack({ packId, idempotencyKey })` → `IWalletPurchaseResult` (`status`: `credited` / `checkout_required` / `declined` / `processing`).
  - `@fonderie/react-billing` + `@fonderie/vue-billing`: `usePurchasePack` — charges the saved card, generates one idempotency key per attempt and retries an indeterminate `processing` in place with the SAME key (so a retry can't double-charge), and resolves to the outcome so the caller can fall back to hosted checkout on `checkout_required`. `@fonderie/react-native-billing` re-exports it.
  
  Buy a credit pack without leaving the site when a card is on file; fall back to hosted checkout only when there's no saved card or the card needs 3-D Secure.

## 0.14.0

### Minor Changes

- 239a69c: Expose the in-app payment-method flow (billing server 8.7.0) through the SDK so a card can be added/replaced/removed without leaving the site:
  
  - `@fonderie/client` `BillingClient`: `setupPaymentMethod()` → `{ clientSecret }` (SetupIntent for the embedded card element), `savePaymentMethod({ paymentMethodId })` → the saved card, `removePaymentMethod()`.
  - `@fonderie/react-billing`: `useSetupPaymentMethod` (resolves the SetupIntent client secret for the Payment Element), `useSavePaymentMethod`, `useRemovePaymentMethod` — same context/explicit-client shape as the other billing hooks. `@fonderie/react-native-billing` re-exports them.

## 0.13.0

### Minor Changes

- d08ff1a: Complete the `BillingClient` public surface so every user-facing billing route has a typed client method:
  
  - `cancelSubscription(input?)` / `reactivateSubscription()` — first-party subscription lifecycle (no billing-portal round-trip), returning the new lifecycle state.
  - `createWalletCheckout({ packId })` — start a one-time credit-pack purchase (returns a hosted checkout URL).
  - `getWalletTransactions({ cursor?, limit? })` — the cursor-paginated wallet ledger (each entry carries `balanceAfter`).
  - `getPaymentMethod()` — the customer's card on file (brand/last4/expiry), for `@fonderie/billing`'s new `/billing/payment-method` route.
  - `listInvoices()` — the customer's invoices (each links to the hosted invoice/PDF), for the new `/billing/invoices` route.
  
  Adds the matching result/input types (`ISubscriptionChangeResult`, `IWalletTransactionDTO`/`IWalletTransactionsResult`, `IWalletCheckoutInput`, `ICancelSubscriptionInput`, `IPaymentMethodDTO`/`IPaymentMethodResult`, `IInvoiceDTO`/`IInvoicesResult`). All are additive.

## 0.12.0

### Minor Changes

- 4e3991f: Phase 5b: spend-purchased toggle — end-to-end API + hooks
  
  The Phase 5a spend-purchased preference (whether a debit may draw down purchased credits once the free allowance is exhausted) is now settable end to end, not just enforced from the database.
  
  - **Server** — new `POST /billing/wallet/preferences` (requireAuth, `walletPreferencesSchema`): `wallet.setPreferences` writes the per-(subscriber, currency) flag via a new `setSpendPurchased` service (UPSERT — creates a zero-balance row if none exists) and returns the refreshed wallet, currency-scoped like `GET /billing/wallet`.
  - **Client** — `BillingClient.getWallet()` and `BillingClient.setWalletPreferences({ spendPurchased })` (with `IWalletDTO` / `IWalletResult` / `IWalletPreferencesInput`) — the first typed wallet surface in `@fonderie/client`.
  - **Hooks** — `useWalletPreferences()` in `@fonderie/react-billing` and `@fonderie/vue-billing` (read current value + `setSpendPurchased(bool)`, refresh-on-mount); carried into `@fonderie/react-native-billing` via its wholesale re-export.
  
  Additive/opt-in. Verified against real PostgreSQL (UPSERT on a no-row subscriber; toggle flips the debit hard-stop end to end) plus client/react/vue tests; adversarially reviewed. Wallet balance/transactions client+hooks remain a later cycle (still allow-listed).

## 0.11.0

### Minor Changes

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
- 579ad09: Fix two phantom auth client types — and the runtime crash they were hiding
  
  `IResendVerificationResult` claimed `{ stat, message, data: { token,
  expiresAt, email } }` — a shape no server path produces (and whose phantom
  `data.token` falsely implied the verification pin is sent to the client; it
  is only ever emailed). It is now `{ email?, verified? }`, matching the
  server's two success branches. `IMfaEnabledResult` claimed `{ tokens, user }`,
  but the MFA setup-confirmation endpoint returns `{ mfaEnabled: true }` — the
  `{ tokens, user }` shape only exists on the mfa-pending login path, which
  `verifyLogin` already types correctly as `ILoginResult`.
  
  The second phantom was hiding a live bug: `useMfaSetup().verify` in
  react-auth, vue-auth, and react-native-auth all read `result.tokens.access`
  after enabling MFA, so every successful enrollment through those hooks threw
  a TypeError at runtime (their own tests asserted the phantom shape against a
  mocked phantom response). The hooks no longer touch the session token —
  correctly, since the server never rotates it on setup confirmation (MFA is
  enforced at login; the current session remains valid unchanged) — and their
  tests now pin the real contract.
- 6a03e90: Align `IUserDTO` and `IPlanDTO` with what the server actually sends
  
  Three drifts between the client types and the server DTOs:
  
  - `IUserDTO.skills` was declared as a required `IUserSkill[]`, but no endpoint has
    ever returned it — the server never mentions `skills` anywhere. Any code
    trusting the type and reading `user.skills.map(...)` would throw on undefined.
    Removed, along with the now-unused `IUserSkill` type and its export.
  - `IUserDTO.isPhoneVerified` is sent by the server but was not declared, so it
    was invisible to hooks and screens.
  - `IPlanDTO.pricingStale` is sent when pricing came from a stale cache during a
    provider outage. Now declared as optional so a billing screen can mark prices
    as indicative.
- ee5c72d: Customers DTO batch: label correlation, honest relationship dates, no more silent no-ops
  
  Six gaps from the DTO audit, fixed together. Email, phone, and address DTOs
  now expose `labelId` (fetched by every query, previously dropped by the
  mappers) so the label-admin surface — `listLabels`/`removeLabel` operate on
  label ids — can finally be correlated with the rows using a label without
  string-matching on the label value. Expanded relationship DTOs gain
  `relationshipCreatedAt`: their spread `createdAt`/`updatedAt` are the
  related CUSTOMER's dates, so sorting relationships by `createdAt` silently
  sorted by customer signup date; the new field carries the relationship
  row's own date (what the un-expanded DTO's `createdAt` always meant), and
  both sides now document the semantics.
  
  Contract honesty: `addRelationshipSchema` requires `relationship` (the
  controller always 422'd without it — an optional schema let a type-correct
  client walk into a guaranteed 422), and referral codes are create-time only:
  `IUpdateCustomerInput` drops `referralCode`/`referredByCode` and
  `updateCustomerSchema` no longer accepts them, so `updateCustomer({
  referralCode })` fails validation instead of returning 200 and changing
  nothing. `GET /customers/labels` responses now go through a proper
  `toCustomerLabelDTO` (the one customers route that leaked raw Date rows),
  and the dead `ICustomerTagDTO`/`toCustomerTagDTO`/`ICustomerTag` exports are
  removed — tag routes emit plain `string[]` and always have.
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
- 6a03e90: Carry member identity in `IMemberDTO`
  
  `GET /workspaces/members` returned ids and roles only. `listMembers()` already
  joins the users table and selects the email, name and avatar, but `toMemberDTO()`
  discarded all four — so a client had nothing to display and fell back to printing
  a truncated user id.
  
  `IMemberDTO` now includes `email`, `firstName`, `lastName` and `profileImageUrl`,
  so a team screen renders from that one call with no second request. Absent values
  are empty strings, matching every other string field in the DTO.
  
  Additive: existing fields and their types are unchanged.

## 0.10.0

### Minor Changes

- 260e752: Phase 3 of the hook-gap audit: one refresh policy everywhere.
  
  **Client:** every cached GET on the typed sub-clients accepts a trailing `opts?: IReadOptions` (`{ bust?: boolean }`) — pull-to-refresh no longer needs cache pokes from app code. Also fixes a latent bug: `sendVerificationEmail` (a GET send-action) now always bypasses the cache — previously a resend within the cache TTL silently no-oped.
  
  **Hooks (react + vue; react-native via re-export):** every list hook's `refresh` accepts `{ force?: boolean }`, busting its own cache namespace. The Group-C standalone mutation hooks are folded into their list-hook siblings, which self-refresh after each write — `useMembers.removeMember`, `useRoles.updateRole`, `useWorkspaces.createWorkspace`/`acceptInvitation`, `usePlans.createPlan`/`updatePlan`/`deletePlan`, `useUsage.recordUsage`, `useWebhookDeliveries.testEndpoint`, `useConfigEntries`/`useSecrets`/`useTemplates` save+delete. The standalone hooks (`useRemoveMember`, `usePlanAdmin`, `useTestWebhookEndpoint`, …) still work but are `@deprecated` with pointers to their new homes.

## 0.9.0

### Minor Changes

- 3c3c68b: Customers pagination, and an MFA setup type correction.
  
  **Pagination (A-104):** `GET /customers` now returns `total` (matching rows regardless of limit/offset) alongside the page. `useCustomers` gains `total`, `hasMore`, and `loadMore()` — an append-fetch of the next page over the same params, mirroring `useAuditEvents`' pagination ergonomics.
  
  **Type correction:** `IMfaSetupResult` now matches what `@fonderie/auth`'s `/auth/mfa/setup` actually returns — `{ qr, backupCodes }` (a data-URI QR code and the one-time backup codes) — instead of the fictional `{ secret, uri }` that never existed at runtime. `useMfaSetup`'s `setupData` is now correctly typed for display.

## 0.8.0

### Minor Changes

- 1d25414: Phase 1 of the hook-gap audit: auth lifecycle and workspace-scoping fixes.
  
  **Client fixes:** `setWorkspaceId` now propagates to the audit and webhooks sub-clients (previously they always hit the caller's personal workspace regardless of the selected team), and the constructor's `workspaceId` option is routed through the same setter instead of being silently ignored. Signing out via `auth.setAccessToken(undefined)` — the hooks' logout path — now clears the shared response cache so one session's data can't be served to the next.
  
  **New hook `useMfaLogin`** (react/react-native/vue): completes a login that returned MFA_REQUIRED via `auth.mfa.verifyLogin`, running the same token persistence as `useLogin` — previously the MFA path never wrote the persisted token, so `useSession` treated MFA users as logged out after restart.
  
  **Storage primitives exported:** `persistToken`, `clearToken`, `readToken`, `TOKEN_KEY` are now exported from each auth package, so apps can wire the client's `auth.onTokensChanged` (silent 401 refresh) and custom logout paths to the same storage the hooks use.

## 0.7.0

### Minor Changes

- 7ab15a8: MFA-aware login and refresh-token-aware logout.
  
  `client.auth.login` is now typed `ILoginResult | IMfaRequiredResult` — when the account has MFA enabled the server returns `{ mfaToken }` with no tokens, and the previous typing hid that branch (hooks crashed reading `result.tokens`). A new exported guard `isMfaRequired(result)` discriminates the union. `useLogin` handles it: on an MFA-required response it skips token persistence, exposes the new `mfaPending` state, and returns the `mfaToken` for `client.auth.mfa.verifyLogin`. The pre-built `LoginScreen`s accept an `onMfaRequired(mfaToken)` callback (React/React Native) or emit `mfa-required` (Vue).
  
  `useLogout().logout(refreshToken?)` and `useSession().logout(refreshToken?)` now pass an optional refresh token through to `client.auth.logout` so the server can revoke the session, matching what the client already supported. Both changes are backward compatible at runtime; TypeScript consumers reading `result.tokens` directly off `login`'s return value must narrow with `isMfaRequired` first.

## 0.6.0

### Minor Changes

- 1c83f8f: Add `auth.mfa.verifyLogin(mfaToken, code)` — a typed method for the MFA-login step
  (completing a login that returned `MFA_REQUIRED`). It sends the temporary `mfaToken`
  as the bearer, so consumers no longer need the generic `post()` + per-call token for
  this flow.

## 0.5.0

### Minor Changes

- e8d0a23: Add an optional per-call `token` to `IRequestConfig` (and `get`/`post`/`put`/`patch`/
  `delete`), overriding the client's stored Bearer for a single request. Enables flows
  that authenticate with a temporary token before the session exists — e.g. MFA login
  (`POST /auth/mfa/verify` with the `mfaToken`) — without dropping to raw HTTP.

## 0.4.0

### Minor Changes

- 4f05eca: feat(client): opt-in response cache + reactive token renewal
  
  Two optional capabilities so apps stop hand-rolling a data layer around the
  client. Both are off by default — existing behaviour is unchanged.
  
  - **Cache** — pass `cache: createMemoryCache()`. GETs are cached (with in-flight
    dedup) and writes auto-invalidate the resource they touch
    (`customers.create()` evicts the customers reads). Per-call control via
    `client.get(path, { cache, bust })` / `post(path, body, { invalidate })`. The
    cache is created **per client instance** (SSR-safe — no module globals, no
    background timer; it sweeps lazily). `clearCache()` and sign-out clear it.
  - **Reactive renew** — pass `auth: { getRefreshToken, onTokensChanged, onAuthError }`.
    On a 401 (never for `/auth/*`), the client refreshes once (single-flight) and
    retries with the new token, so both typed modules and the generic transport
    renew automatically.

## 0.3.0

### Minor Changes

- e614d99: feat(client): Fonderie-aware HTTP transport for custom endpoints
  
  Adds a generic, authenticated transport to `FonderieClient` so an app's own
  endpoints (on the same backend) get the same JWT + `X-Workspace-ID` as the typed
  modules — no hand-rolled axios:
  
  - `client.request({ method, path, body?, workspaceId? })`
  - `client.get / post / put / patch / delete(path, …)`
  - `client.setAccessToken(token)` and `client.setWorkspaceId(id)` (the latter also
    propagates to the workspace-scoped modules, so one call configures the client).
  
  All calls return the standard `{ reason, explanation, result }` envelope and throw
  `FonderieApiError`. Purely additive — existing typed methods are unchanged.

## 0.2.0

### Minor Changes

- dc96eeb: fix(client): align the auth/users surface with @fonderie/auth routes
  
  The client had drifted from the server's actual routes, so several auth and
  user flows failed. Audited every client module against its package; **workspaces,
  billing, and customers already matched** — auth did not. Corrected:
  
  **Fixed drifted endpoints**
  - `verifyEmail` → `POST /auth/verify` `{ token }` (was `/auth/email/verify` `{ pin }`); now sends the auth token (route is `requireAuth`).
  - `sendVerificationEmail` → `GET /auth/send-verification` (was `POST /auth/email/send-verification`).
  - `resetPassword` input → `{ pin, password }` (was `{ resetToken, password }`).
  - `mfa.disable` body → `{ token }` (was `{ code }`; server validates `mfaTokenSchema`).
  
  **Replaced the nonexistent `PUT /users/update`** (`updateUser`/`IUpdateUserInput` removed) with the server's dedicated routes:
  - `updateProfile` → `PUT /users/profile`, `updatePreferences` → `PUT /users/preferences`,
    `updateEmail` → `PUT /users/email`, `updatePhone` → `PUT /users/phone`,
    `changePassword` → `PUT /users/password`.
  
  **Added missing endpoints**
  - `exportData` → `GET /users/export` (SAR bundle).
  - `mfa.regenerateBackupCodes` → `POST /auth/mfa/backup-codes`.
  
  **Removed dead code**
  - `AuthClient.phone` / `PhoneClient` (`/auth/phone/*` — not registered by `@fonderie/auth`).
  
  BREAKING (types only; the removed members targeted routes that returned 404):
  `updateUser`, `IUpdateUserInput`, `client.auth.phone`, and `IPhoneVerifyResult`
  are removed. Aligns the client with the battle-tested production backend contract.
- 0cd4bb8: feat(workspaces): add GET /workspaces/roles/:roleId/permissions
  
  Roles could only have permissions *set* (POST) — there was no way to *read* a
  role's permissions. Adds the missing read endpoint:
  
  - `@fonderie/workspaces`: `getRolePermissions` service + `RoleModel.getPermissions`
    + `role.getPermissions` controller, registered as
    `GET /workspaces/roles/:roleId/permissions` (requireAuth, workspace-scoped).
  - `@fonderie/client`: `workspaces.getRolePermissions(roleId)` returning
    `{ permissions: IRolePermission[] }`.

### Patch Changes

- f38e00e: refactor(client): name MFA params `token` to match the wire field
  
  `mfa.verify` / `mfa.disable` / `mfa.regenerateBackupCodes` now take a `token`
  parameter and send `body: { token }` directly, instead of mapping a `code`
  param onto `{ token: code }`. No behavior change — the request is identical.

## 0.1.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 0.1.0

### Minor Changes

- First public release of the Fonderie SDK.
