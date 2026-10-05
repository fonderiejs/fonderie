# @fonderie/workspaces

## 6.11.0

### Minor Changes

- df7d240: People are told when the team changes around them (docs/INSIDER-THREAT-DESIGN.md, Phase 2).
  
  A rogue manager's work could go unnoticed for days: nobody removed, demoted or handed a team was told. Now these emails go out:
  
  - **Removed member** (`workspace-member-removed`): told they were removed, and by whom.
  - **Owner alert** (`workspace-member-removed-alert`): the owner is told when a **manager** removed someone.
  - **Former manager** (`workspace-manager-removed`): told they are no longer a manager.
  - **New owner** (`workspace-ownership-received`): told they now own the workspace, and who handed it over.
  
  Default copy ships in English, French, Spanish and Simplified and Traditional Chinese. The emails are driven by the Phase 1 trail events through the durable outbox, so they go out only for a change that happened. Names and addresses are read when the email is sent; the trail itself stays ids-only. An account awaiting deletion is not written to.
  
  Turn this off with `teamNotices: false`. Route the four keys in courier like `workspace-invitation`.

## 6.10.0

### Minor Changes

- 25196eb: A rogue manager can no longer purge the other managers or lock the team out, and every team change now says who did it (docs/INSIDER-THREAT-DESIGN.md, Phase 1).
  
  A workspace run by several managers had no defence against one of them turning: any manager could remove every other manager, and archive the whole workspace, and nothing recorded who did it. The audit trail could not answer "who removed whom", because team changes emitted no events at all.
  
  - **Managers are peers.** `DELETE /workspaces/members/:userId` refuses a manager unless the owner is asking: `403 MANAGER_PROTECTED`. The check runs under the workspace lock. A manager still removes plain members and can still leave.
  - **Archiving is owner-only.** `POST /workspaces/archive` locks every member out, so it now needs the owner (`403 OWNER_REQUIRED`). Restore stays a manager action.
  - **The trail.** Every successful team, role, invitation, settings and workspace change emits `fonderie.workspace.*` (`member.removed`, `member.left`, `member.role.added|removed`, `manager.set|unset`, `ownership.transferred`, `invitation.created|cancelled|resent|accepted`, `role.created|updated|deleted|permissions.set`, `created`, `updated`, `archived`, `restored`, `settings.updated`) with `{ workspaceId, userId: <actor>, targetUserId?, roleId?, inviteId(s)? }`. Payloads carry ids only, so the trail holds no personal data and survives account erasure, including the actor's own. A refused request emits nothing. `@fonderie/audit` lists these per workspace and filters by actor.

## 6.9.0

### Minor Changes

- 5eab35d: Deleting an account now erases what workspaces holds about the person. `accountEraser(store)` is what the account purge calls, once the grace period is over, just before the user row goes: it removes every membership of theirs, every invitation sent to their address (any status, including a `+tag` alias of it), their personal workspace, and every workspace they own that nobody else still belongs to — with its roles, role permissions, memberships and invitations. Workspaces that stay forget who archived them.
  
  A workspace they own that still has other members is never deleted under them: it is left in place and the erasure reports it (`kept`), so the operator can see a team still needs a new owner. Running the eraser twice is harmless; the second run erases nothing.

## 6.8.1

### Patch Changes

- 29120f9: Concurrent changes to one team are now applied one at a time (database audit,
  batch 2). Each was reproduced with a race test that fails on the previous code.
  
  - **Seat limit** — invites checked the seat count and inserted separately, so
    two managers inviting at once with one seat left both got it (N at once: N-1
    over). The count and the inserts now run under a lock on the workspace row.
  - **Ownership transfer** — two transfers at once both answered "transferred"
    though only one applied, and a member removed mid-transfer could become the
    owner. The transfer now locks the workspace and the new owner's membership and
    reports failure when it did not apply.
  - **Removing vs. assigning** — a role assigned while the person was being
    removed stayed live (a removed person holding a role), and revoking manager
    rights while another role was removed could leave someone with no role at all.
    Every change to a person's roles (remove, assign, set/unset manager, delete a
    role they hold) now takes one lock on their membership first. Removing someone
    who is not a member answers 404 MEMBER_NOT_FOUND instead of a misleading 200.
  - **Role permissions** — two saves at once produced the UNION of both (switches
    nobody chose). The role row is locked; the last save wins; one INSERT.
  - **Invitation accept** — the claim now re-checks expiry and the credential
    (a resend replaces it) in the same statement, and grants the role it claims —
    with the "still assignable" check inside the insert, rolled back if not.

## 6.8.0

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

## 6.7.1

### Patch Changes

- 52dfcdb: A deleted account is ARCHIVED for its grace period, and now behaves like it
  (account-deletion design, Phase 1 — docs/ACCOUNT-DELETION-DESIGN.md).
  
  - **Signing in** to an archived account with the right password, or a verified
    Google / Apple identity, answers `403 ACCOUNT_PENDING_DELETION` with
    `details.requestedAt` and `details.deleteOn`, so an app can say when it will be
    deleted. A wrong password is still the plain `401 INVALID_CREDENTIALS` — no
    account-existence oracle. (Phone sign-in follows in Phase 2, with restore.)
  - **Signing up** again with the address or phone of an archived account answers
    `409 ACCOUNT_PENDING_DELETION` instead of a 500 — and no longer rewrites the
    archived account (phone sign-up overwrote its name; Google / Apple sign-in
    rewrote its provider fields, then failed).
  - **Reset and verification codes** issued before the deletion stop working: they
    are removed when the account is archived, and a reset never applies to an
    archived account.
  - New `accountDeletion.gracePeriodDays` (default 30) dates the deletion; purge
    with the same number.
  - **Workspaces:** a member whose account is deleted is no longer listed (name,
    email, photo) or counted as a seat; restoring the account brings them back.
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

## 6.7.0

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

## 6.6.1

### Patch Changes

- 1867604: Two businesses with the same name can both create a workspace. The slug was the
  lower-cased name with no de-duplication, so the second "Acme Plumbing" — and the
  second business whose name has no Latin letters (水管公司 slugs to an empty
  string) — hit the unique slug index and got a 500. A taken slug now gets a short
  random suffix (`acme-plumbing-3f9a1c`), and an empty one falls back to
  `workspace`.

## 6.6.0

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

## 6.5.0

### Minor Changes

- 7ec4d32: Every email is written in its recipient's language, including the ones sent without a signed-in user.
  
  Billing receipts and notices, and workspace invitations, passed no language, so a French- or Chinese-speaking customer got them in the system default (English). Courier now decides in this order:
  
  1. the `locale` the sender passed (auth already passes the signed-in user's);
  2. **the language of the account the recipient's email or phone belongs to** (`@fonderie/auth`'s users, same database);
  3. the new `fallbackLocale` on the message: the business's language, for someone without an account;
  4. the system default.
  
  - `ICourierMessage.fallbackLocale` (core).
  - Courier: the account lookup is on by default; `recipientLocaleLookup: false` turns it off (e.g. when accounts live in another database). The message log records the language actually used.
  - Workspaces: an invitation carries the workspace's language as its fallback, so a Quebec business invites in French. An invitee who already has an account still gets their own language.
  - Billing: `IBillingRecipient` takes `locale` and `fallbackLocale`, so an app's `resolveRecipient` can say which language to use. Without either, courier uses the recipient's account.

### Patch Changes

- Updated dependencies [7ec4d32]
  - @fonderie/core@0.30.0
  - @fonderie/rate-limit@4.0.33

## 6.4.0

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

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/core@0.29.0
  - @fonderie/rate-limit@4.0.32

## 6.3.0

### Minor Changes

- 64aefa4: Permissions work end to end, from one declared list to the button a member sees.
  
  - **One catalog**: `new PermissionsModule(store, { catalog: [{ key: 'jobs' }, { key: 'reports', operations: ['read'] }] })`. A role editor reads it (`GET /workspaces/permissions/catalog`, `usePermissionCatalog`). Saving a role refuses a key outside it (`422 UNKNOWN_PERMISSION`) or an operation the resource does not have (`422 UNSUPPORTED_OPERATION`), so no switch can promise a restriction the server never checks.
  - **Rights for the built-in roles, from config**: `systemGrants: { GUEST: { jobs: ['read'] } }`. The system roles are shared by every workspace, so their rights are read from config at check time: every workspace, existing ones included, has them at once, with no seeding or backfill. A workspace's own role named `GUEST` gets none of them. A `systemGrants` key missing from the catalog stops the app at boot.
  - **What may I do here?** `GET /workspaces/current/permissions` returns `isOwner`, `isManager`, `isSuper` and per-resource rights (the union across all the member's roles). `usePermissions()` / `useCan(op, resource)` in React, React Native and Vue answer **no until the server has answered**, and re-read on a workspace switch and after any workspace write (a role change).
  - **Customers obey permissions**: `new CustomersModule(store, { permission: 'customers' })`. Reads need `read`; creating a customer `create`; deleting one `delete`; every other write (emails, notes, tags, blacklist…) `update`. Unset: unchanged.
  - **Deleting a role** now also removes its assignments and grants (before, they were left pointing at nothing). Anyone for whom it was the only role stays on the team with the default role, and the response (and `useRoles().removeRole`) says `{ membersAffected, movedToDefaultRole }`.
  - Hooks taking an id (`useRole`, `useRolePermissions`, `useMemberRoles`, `useWorkspace`) wait instead of requesting with an empty one.

## 6.2.0

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

## 6.1.8

### Patch Changes

- 87f6e1d: **`workspace.plan` is marked deprecated.** The field is set to `'free'` when a workspace is created and nothing ever updates it — not a subscription, an upgrade or a cancellation — so an app reading it shows "free" for a paying workspace. It is now documented as such; read the workspace's subscription from `@fonderie/billing` (`GET /billing/subscription` with `X-Workspace-ID`, `useSubscription()` in the frontend packages). No behaviour change.

## 6.1.7

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0
  - @fonderie/rate-limit@4.0.31

## 6.1.6

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0
  - @fonderie/rate-limit@4.0.30

## 6.1.5

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0
  - @fonderie/rate-limit@4.0.29

## 6.1.4

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0
  - @fonderie/rate-limit@4.0.28

## 6.1.3

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0
  - @fonderie/rate-limit@4.0.27

## 6.1.2

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

## 6.1.1

### Patch Changes

- Updated dependencies [4a4541f]
  - @fonderie/core@0.23.0
  - @fonderie/rate-limit@4.0.25

## 6.1.0

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

## 6.0.20

### Patch Changes

- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0
  - @fonderie/rate-limit@4.0.23

## 6.0.19

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.

## 6.0.18

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0
  - @fonderie/rate-limit@4.0.22

## 6.0.17

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

## 6.0.16

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0
  - @fonderie/rate-limit@4.0.20

## 6.0.15

### Patch Changes

- Updated dependencies [38f2410]
  - @fonderie/core@0.20.0
  - @fonderie/rate-limit@4.0.19

## 6.0.14

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0
  - @fonderie/rate-limit@4.0.18

## 6.0.13

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0
  - @fonderie/rate-limit@4.0.17

## 6.0.12

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0
  - @fonderie/rate-limit@4.0.16

## 6.0.11

### Patch Changes

- Updated dependencies [d470d85]
  - @fonderie/core@0.16.0
  - @fonderie/rate-limit@4.0.15

## 6.0.10

### Patch Changes

- Updated dependencies [ff1120b]
  - @fonderie/store@0.5.0
  - @fonderie/rate-limit@4.0.14

## 6.0.9

### Patch Changes

- Updated dependencies [b932c3c]
  - @fonderie/store@0.4.0
  - @fonderie/rate-limit@4.0.13

## 6.0.8

### Patch Changes

- Updated dependencies [0d71572]
  - @fonderie/core@0.15.0
  - @fonderie/rate-limit@4.0.12

## 6.0.7

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

## 6.0.6

### Patch Changes

- Updated dependencies [3e18d73]
  - @fonderie/core@0.13.0
  - @fonderie/rate-limit@4.0.10

## 6.0.5

### Patch Changes

- Updated dependencies [0f11dc8]
  - @fonderie/core@0.12.0
  - @fonderie/rate-limit@4.0.9

## 6.0.4

### Patch Changes

- Updated dependencies [7a76978]
  - @fonderie/core@0.11.0
  - @fonderie/rate-limit@4.0.8

## 6.0.3

### Patch Changes

- 9156a68: Re-validate the invitation role at ACCEPT time (defense-in-depth). The `roleId` is validated when the invitation is created, but accept now re-confirms it is still assignable — a workspace-local non-system role, or the seeded least-privilege system GUEST default — so a role that has since become non-assignable (or a directly-written bad row) can never grant a privileged membership. A system ADMIN or a foreign workspace's role is refused.

## 6.0.2

### Patch Changes

- be7a6e7: Validate the invitation `roleId` like a direct role assignment. An explicit `roleId` on `POST /workspaces/invitations` flowed unvalidated into the membership INSERT on accept — bypassing `addRoleToMember`'s workspace-local + non-system rule, so a manager could grant the system ADMIN role or another workspace's role via invitation (foreign role names then satisfied name-based role checks). Explicit role ids must now be a non-system role of the inviting workspace (`422 INVALID_ROLE` otherwise); the least-privilege system GUEST default is unchanged.
- Updated dependencies [be7a6e7]
  - @fonderie/core@0.10.0
  - @fonderie/rate-limit@4.0.7

## 6.0.1

### Patch Changes

- 444f316: Manager gates match role NAMES, not just `is_system` (closes a hole in the just-shipped RBAC gates). Both `ADMIN` and `GUEST` are seeded system roles, and every default invitation lands on `GUEST` — so "holder of any active system role" made every default-invited member a manager, defeating the gate. `requireManager` (workspaces) and `requireBillingManager`/`isWorkspaceManager` (billing) now accept the workspace owner or a holder of an active **system role whose name is in the manager list** — default `['ADMIN']`, configurable via the new `managerRoles` config option in both packages. The `is_system` restriction remains (a member-created local role named 'ADMIN' still grants nothing).

## 6.0.0

### Major Changes

- cd2706a: Invitation hardening + last-owner guard (BREAKING for the PIN flow). (1) H4: the 6-digit invitation PIN was minted with `Math.random()` and looked up **globally** with no throttle — any authenticated user could brute-force any pending invitation and join arbitrary workspaces. The PIN now comes from a CSPRNG, only redeems an invitation addressed to the **accepting user's email**, and `POST /workspaces/invitations/accept` is IP rate-limited (10/15 min; backed by `@fonderie/rate-limit`, new dependency). The accept body now also takes `{ token }` (the 32-byte secret from the email link) as an alternative to `{ pin }` — the path for accounts without an email address. (2) H5: `DELETE /workspaces/members/:userId` refused to let you remove yourself but happily removed the workspace **owner**, orphaning the tenant — now `400 INVALID_OPERATION`. (3) The invitation list/DTO leaked the accept `token` — a bearer credential meant only for the invitee's inbox — letting any member hijack a pending invite; the DTO field remains for shape compatibility but is now always empty.
- cd2706a: Privileged workspace routes now require a manager (BREAKING). Every mutating route — role create/update/delete/set-permissions, member remove and role assign/unassign, invitation create/cancel, settings update, archive/restore, workspace update — previously only verified *membership*; any member could manage roles, evict members, or archive the tenant. These routes now additionally require the caller to be the workspace **owner** or hold an **active system role** (the seeded ADMIN), via the new exported `requireManager` middleware. Reads, invitation acceptance, and workspace creation/listing are unchanged, and personal workspaces pass via ownership. Apps that deliberately run flat teams can restore the old behaviour with `management: 'any-member'` in the module config.

### Patch Changes

- Updated dependencies [cd2706a]
  - @fonderie/store@0.3.0
  - @fonderie/rate-limit@4.0.6

## 5.3.2

### Patch Changes

- Updated dependencies [2a22d14]
  - @fonderie/core@0.9.0

## 5.3.1

### Patch Changes

- fc6b4c4: Close two workspace role vulnerabilities. (1) Privilege escalation via role assignment: `POST /workspaces/members/:userId/roles` accepted any role id, so a member could self-grant the seeded system `ADMIN` role (super-role bypass) or a role id from another workspace. Assignment now only succeeds for a role that belongs to the caller's workspace and is not a system role, and returns `422 INVALID_ROLE` otherwise. (2) Cross-workspace role IDOR: reading and mutating a role by id (`getRoleById` / `updateRole`, and the `getRole` / `updateRole` / `getRolePermissions` / `setRolePermissions` routes) were not workspace-scoped, letting a member of one workspace read or rename/deactivate another workspace's roles. All role lookups and mutations are now scoped to `workspace_id` (or a global system role for reads).

## 5.3.0

### Minor Changes

- e717ccb: Ship a default email template for the workspace-invitation notification (P2 of the notification-template normalization).
  
  `@fonderie/workspaces` now exports `DEFAULT_TEMPLATES` covering its one message key (`workspace-invitation`), lifted from courier's seed. Pass it to courier via `config.templates.defaults` and the invitation email renders out of the box — no per-app authoring, never the raw-JSON fallback; override per-app with a DB row / FS file. The copy uses `{{pin}}` (the payload's `token` is intentionally not surfaced). `satisfies Record<WorkspacesMessageKey, IDefaultTemplate>` makes a missing key a compile error; a coverage test asserts it renders cleanly with the real payload and is assignable to courier's `DefaultTemplateMap`. Additive; requires `@fonderie/core >= 0.8.0` + `@fonderie/courier >= 5.2.0`.

## 5.2.3

### Patch Changes

- Updated dependencies [ca7777f]
  - @fonderie/core@0.8.0

## 5.2.2

### Patch Changes

- Updated dependencies [f3656f8]
  - @fonderie/core@0.7.0

## 5.2.1

### Patch Changes

- Updated dependencies [0f0ca59]
  - @fonderie/core@0.6.0

## 5.2.0

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
- 6a03e90: Carry member identity in `IMemberDTO`
  
  `GET /workspaces/members` returned ids and roles only. `listMembers()` already
  joins the users table and selects the email, name and avatar, but `toMemberDTO()`
  discarded all four — so a client had nothing to display and fell back to printing
  a truncated user id.
  
  `IMemberDTO` now includes `email`, `firstName`, `lastName` and `profileImageUrl`,
  so a team screen renders from that one call with no second request. Absent values
  are empty strings, matching every other string field in the DTO.
  
  Additive: existing fields and their types are unchanged.

### Patch Changes

- 400d9f1: Workspace, member, and invitation timestamps serialize as ISO strings again
  
  In production the pg driver returns TIMESTAMPTZ columns as Date objects, and
  `toWorkspaceDTO`/`toMemberDTO`/`toInvitationDTO` mapped every timestamp
  through `stringOrEmpty` — which returns `''` for anything that isn't already
  a string. So `createdAt`/`updatedAt`/`archivedAt` on workspaces, the member
  join date, and — most visibly — the invitation `expiresAt` a UI needs to
  show invite expiry, all serialized as empty strings, while the client types
  declare real strings. (Unit tests missed it because their stubs fed ISO
  strings where pg delivers Dates.)
  
  All six mappings now use core's `dateOrEmpty`, the same convention the
  customers package already follows, and new tests feed actual Date objects to
  pin the ISO contract. `archivedAt` stays `''` for non-archived workspaces
  with `isArchived` derived independently, as before.

## 5.1.0

### Minor Changes

- 0cd4bb8: feat(workspaces): add GET /workspaces/roles/:roleId/permissions
  
  Roles could only have permissions *set* (POST) — there was no way to *read* a
  role's permissions. Adds the missing read endpoint:
  
  - `@fonderie/workspaces`: `getRolePermissions` service + `RoleModel.getPermissions`
    + `role.getPermissions` controller, registered as
    `GET /workspaces/roles/:roleId/permissions` (requireAuth, workspace-scoped).
  - `@fonderie/client`: `workspaces.getRolePermissions(roleId)` returning
    `{ permissions: IRolePermission[] }`.

## 5.0.0

### Patch Changes

- Updated dependencies [b1d053c]
- Updated dependencies [dfdcebb]
  - @fonderie/core@0.5.0
  - @fonderie/events@5.0.0

## 4.0.0

### Minor Changes

- 9eb3c80: Add `importRole` — completes the workspaces migration trio (`importWorkspace` →
  `importRole` → `importMembership`). Imports a custom, workspace-scoped role
  preserving its id so migrated memberships resolve to it; `is_system` stays false
  (system roles are seeded, resolve those by name). Supplied fields preserved,
  omitted ones take table defaults.
- 5130aba: Add `importWorkspace` + `importMembership` — the workspaces write-side of
  migrating an existing app onto Fonderie (mirrors `importUser` in
  `@fonderie/auth`). `importWorkspace` preserves the original id, `ownerId`,
  `createdAt`, settings and org-profile fields; `importMembership` restores the
  user↔workspace↔role join (replay-safe). A migration is: `importUser` →
  `importWorkspace` → resolve a role (seeded system role or a custom one) →
  `importMembership`. Supplied fields preserved, omitted ones take table defaults.

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

## 2.1.0

### Minor Changes

- bd4e8db: Add `routes` to `IWorkspacesConfig` — override any workspace route's path (and optionally method) by a stable id, matching `@fonderie/auth`'s `routes` config. This closes the last client-app contract divergence: a frontend that does `PUT /workspaces/:id` (id in the path) maps onto Fonderie's header-based update with a single line — `routes: { updateWorkspace: '/workspaces/:id' }` — because `wsCtx` already resolves the workspace from the `:id` path param first. No param-extraction shim needed. A bare string overrides the path; an object can also change the method; unset routes keep defaults.

## 2.0.0

### Minor Changes

- c0f05ea: Decouple workspaces from billing. `@fonderie/workspaces` no longer hard-depends on `@fonderie/billing` — you can register and boot workspaces (create/read/update, invitations, roles, members) without wiring billing or a Stripe provider. Billing stays an _optional_ enhancement: when it's registered, seat limits on invitations are enforced; when it's absent, invitations are unlimited (fail-open, as before). Implementation also fixes an architecture-law violation — workspaces now reads billing's seat limit through `ctx.meta['billing']` (the sanctioned inter-package channel) instead of importing `getPlanLimit` from the billing package. Surfaced by the client-app backend rewrite (Phase 1), where a field-service app that only reads a workspace was forced to wire payments.

### Patch Changes

- Updated dependencies [bbd3e9a]
- Updated dependencies [f18ac65]
- Updated dependencies [e4d9bb2]
  - @fonderie/core@0.2.0
  - @fonderie/events@2.0.0

## 1.2.2

### Patch Changes

- 9cbb2eb: Ship each package's migration SQL inside its tarball. `createMigrationsPath()` resolves to `dist/migrations/sql/` at runtime, but tsup bundles JS only, so published packages shipped the migration _loader_ without the `.sql` files it reads — a consumer running the shipped migrations found nothing and had to hand-write schema. The shared migrations build now copies `src/migrations/sql/` into `dist/migrations/sql/`, which `files:["dist"]` carries into the tarball.

## 1.2.1

### Patch Changes

- 01a2b72: Ship the co-located brain fragment (`brain/{signatures,outcomes}.md`) inside each package tarball (R3). The project-brain compiler reads the installed package's own fragment, so brain knowledge is version-matched by construction — no central registry to skew against. No runtime code change; adds `brain/` to the published files only.

## 1.2.0

### Minor Changes

- 87b1e2a: Remove the dead `defaultRole` config option. It was never read by any code
  path and its documented `'member'` default never existed; since 1.1.1
  invitations without an explicit `roleId` always resolve to the seeded
  system GUEST role. Passing `defaultRole` was silently ignored before —
  now it's a compile error, which is the honest signal.

## 1.1.1

### Patch Changes

- Security: invitations without an explicit `roleId` now default to the seeded
  system GUEST role (least privilege) instead of resolving a workspace-scoped
  ADMIN role. Previously, apps that seeded per-workspace ADMIN roles would
  silently grant every bare invite full admin rights; apps that didn't would
  500 with "Default role not found". Granting a privileged role now always
  requires passing `roleId` (from `GET /workspaces/roles`).

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
  - @fonderie/billing@1.0.1
  - @fonderie/events@1.0.1
  - @fonderie/store@0.1.1
  - @fonderie/core@0.1.1

## 1.0.0

### Minor Changes

- First public release of the Fonderie SDK.

### Patch Changes

- Updated dependencies
  - @fonderie/billing@1.0.0
  - @fonderie/core@0.1.0
  - @fonderie/events@1.0.0
  - @fonderie/store@0.1.0
