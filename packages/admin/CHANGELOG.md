# @fonderie/admin

## 1.7.7

### Patch Changes

- Updated dependencies [54d2ec2]
  - @fonderie/core@0.28.0

## 1.7.6

### Patch Changes

- Updated dependencies [d00281b]
  - @fonderie/core@0.27.0

## 1.7.5

### Patch Changes

- Updated dependencies [a0a712e]
  - @fonderie/core@0.26.0

## 1.7.4

### Patch Changes

- Updated dependencies [e10f440]
  - @fonderie/core@0.25.0

## 1.7.3

### Patch Changes

- Updated dependencies [0ea79cd]
  - @fonderie/core@0.24.0

## 1.7.2

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

## 1.7.1

### Patch Changes

- 8dd41f4: Docs: the config README names the encryption key `CONFIG_SECRET_KEY` (it said `SECRET_KEY`, which no deployment uses) and no longer claims the encryptor can be created from an unset key — `createAesGcmEncryptor` throws on that. The admin README documents the environment report at `GET /_admin/environment` (it named `/_admin/config`, which belongs to @fonderie/config) and no longer states that bricks never read `process.env`.

## 1.7.0

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

## 1.6.0

### Minor Changes

- 1b349ba: The console shows every email and every language it exists in — Fonderie's built-in copy included.
  
  - **courier** — `GET /admin/template-catalog`: every email (saved or built-in only) with its built-in languages and saved versions, plus the app's system locale and fallback chains. The flat list only had saved rows, so a built-in email nobody had edited — every billing email — was invisible and could not be edited from the console. `GET /admin/templates/:type/built-in?locale=` returns Fonderie's copy in a language; `GET /admin/templates/:type/resolve?locale=` answers "who receives what" with the same function a real send runs (`chooseCopy`), so the console cannot disagree with delivery.
  - **client / hooks** — `getTemplateCatalog`, `getBuiltInTemplate`, `resolveTemplate`; `useTemplateCatalog`, `useBuiltInTemplate`, `useTemplateResolution` (React and Vue); `templateLanguages` / `suggestTemplateLocales` shared by both consoles. `useTemplate` now clears the shown version on a 404 instead of keeping a deleted one on screen.
  - **screens / admin** — the list is one row per email with an aligned language column sorted by code, the default version labelled with the system locale (`en-US`); solid = a version you saved, dashed = Fonderie's built-in copy. A built-in language opens prefilled and saving creates your version; "Reset to built-in" returns a language to Fonderie's copy (and the default version to its built-in text, as a new version). The editor shows the fallback chain and a "who receives what" check; adding the system locale is refused. `TemplateListScreen`'s selection callback now receives `{ type, locale, system }` rather than a full stored row, since a built-in email may have none.

## 1.5.1

### Patch Changes

- Updated dependencies [973faad]
  - @fonderie/core@0.22.0

## 1.5.0

### Minor Changes

- 6acfb5b: Adding a locale or a new template now has the same live preview as the editor, and flags fields still identical to the default copy ("Still the default copy: Subject, Plain-text body") — a half-translated email looked finished in a textarea and only showed its English subject once sent. The console page now loads its script as `app.js?v=<version>`, so a page opened after a deploy never reuses the previous bundle from cache.

## 1.4.0

### Minor Changes

- 585fa8b: Email templates show their locales. The template list is one row per email with a chip for each locale it exists in (inactive ones struck through), instead of one flat row per (type, locale) pair that left an operator guessing which translations exist. The editor has a tab per locale: switching asks before discarding unsaved edits, and "+ Add locale" is offered on every locale and suggests the locales the app already uses elsewhere that this email lacks. New in `@fonderie/client`: `groupTemplatesByType` and `missingTemplateLocales`, shared by the React and Vue screens. `TemplateEditorScreen` gains `onSelectLocale` (Vue: `localeTabs` + `select-locale`); `onAddLocale` / `add-locale` now also receive `{ locales }`.

## 1.3.0

### Minor Changes

- b94ed53: The admin console speaks English, French and Spanish.
  
  The console's language is the OPERATOR's preference, independent of the locales the app serves its customers — a founder in France can run the console in French while every customer email stays English. It defaults to the browser's language, is stored per browser (`fonderie.admin.locale`), and is switched from the sidebar footer: a Language row with a menu (English / Français / Español, a check on the current one) above a Theme row with an icon-only System / Light / Dark control. The sign-in and onboarding screens carry the same controls, and a French or Spanish browser gets them in its language from the first screen.
  
  - `@fonderie/client`: `createAdminT(locale)`, `formatAdminDate`, `detectAdminLocale`, `ADMIN_LOCALES`, `adminLocaleNames` and the dictionaries — English canonical, French and Spanish typed against it, so a missing or extra key is a compile error; a test also checks every translation is non-empty and keeps the same `{placeholders}`.
  - Every console screen (React and Vue) takes an optional `locale` prop — `uiLocale` on `TemplateEditorScreen`, whose `locale` is the template's — and `AdminShell` passes it down. Omitted ⇒ English, so embedding apps are unaffected.
  - Dates follow the console language. Sign-in errors from known server reasons are shown translated; other server messages (check findings, validation from the API) stay as the server sends them.

## 1.2.5

### Patch Changes

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

## 1.2.4

### Patch Changes

- 2c350b5: Deleting an account now stops its billing, and purging it erases the payment provider's copy.
  
  Before: `@fonderie/auth` soft-deleted the user and emitted `fonderie.user.deleted`, but nothing listened — an active subscription kept renewing on a card the person could no longer sign in to cancel.
  
  - **Billing, on `fonderie.user.deleted`** (needs the event bus): cancels the user's subscription at the provider — immediately by default; `onSubscriberDeleted: 'cancel-at-period-end' | 'keep'` to change that — and disarms off-session charging (auto-recharge off, stored card and any pending recharge key forgotten). No automatic refund; the app decides. Workspace subscriptions are untouched. Idempotent: an "already canceled" answer from the provider is success, a real failure throws so the bus redelivers.
  - **Billing, on `fonderie.user.purged`:** deletes every provider customer record the user had (subscription and wallet customers) — the email and saved cards. The provider keeps its invoices; local subscriptions, ledger and balances stay as financial records keyed by an id that no longer resolves to a person. New optional provider method `deleteCustomer` (Stripe: `customers.del`, already-deleted is a no-op).
  - **Auth:** `purgeSoftDeletedUsers` / `startUserRetention` take an optional `bus` and emit `fonderie.user.purged` { userId } for each hard-deleted account, after the delete. `EVENT_KEYS.userPurged`. The admin user lookup by id resolves soft-deleted accounts (with `deletedAt`); `GET /_admin/users?deleted=1` lists only them.
  - **Client / hooks:** `listUsers({ deleted: true })`; `useAdminUsers` passes it through.
  - **Console:** Users gets an Active / Deleted switch; a deleted account shows "Deleted on …" instead of account actions, sessions and sign-ins, and keeps its Plan & credits.

## 1.2.3

### Patch Changes

- 42f52ae: Opening a subscriber whose account no longer exists (deleted or purged, billing rows left behind) showed "No user with that email." — wrong on two counts: the lookup was by id, and the page dead-ended. It now says "No account with id … — it was deleted, or never existed here. Its billing records remain." and still shows that subscriber's plan, credits, grant form and ledger.

## 1.2.2

### Patch Changes

- eb90854: Billing lives on the user. Every user is billable — a wallet needs no subscription, and no subscription means the free tier — but the Subscriber page listed only people with a subscription, so free users could not be found to grant credits.
  
  - **Users:** a Plan column (plan name, or "free"), and a "Plan & credits" section on each user: plan and status with renew/end date, credit balance, the grant form and the ledger. `UsersScreen` takes optional `billingClient` and `openUserId`.
  - **Subscriptions** (was "Subscriber"): a money list — who pays, who is behind — with status filters and counts, and a "Renews / ends" column. Opening a user subscriber goes to their user page; workspace subscribers open in place. `SubscriberScreen` takes `onOpenUser`.
  - **Fixes:** a canceled subscription said "Renews"; it now says "Ends" or "Ended". The credit breakdown read "granted 0 · purchased 5" after an admin grant; it now reads "5 permanent · 0 plan allowance" (admin grants and purchases never expire; the plan allowance can).
  - New shared `SubscriberBilling` component in both packages.

## 1.2.1

### Patch Changes

- 2757e08: Zero-config operator onboarding. First-time setup is a guided flow with a progress bar — admin token → your account → authenticator → backup codes (invite and recovery links show the last three). The admin token is asked for alone and checked against the server before the account form appears. `operatorKey` no longer raises a readiness warning when unset — it is optional hardening (encrypts authenticator secrets at rest against a database leak), not a required second environment variable; a leaked authenticator secret still needs the operator's scrypt-hashed password. A malformed key is still an error.

## 1.2.0

### Minor Changes

- 431aa20: Operator accounts for the admin console: people sign in with email, password and a mandatory authenticator app instead of pasting a token.
  
  A token is a shared secret with no name on it — pasted into chat, saved in notes, logged as "admin-token". With a `store`, `@fonderie/admin` now has operators:
  
  - **No registration.** The first operator is claimed once with the root `adminToken`; every other one is invited by an Owner through a single-use, expiring link. Operators live in their own table — an app sign-up or an app account takeover can never produce one.
  - **Mandatory second factor.** RFC 6238 codes with a replay guard, QR enrollment, ten single-use backup codes shown once. Secrets sealed at rest with the new `operatorKey` (64 hex).
  - **Step-up.** Revealing a secret, minting a token or link, applying a migration and deleting need a code from the last five minutes; the console prompts and retries the action.
  - **Sessions.** HttpOnly SameSite=Strict cookie (`__Host-` over HTTPS), 30 min idle / 12 h absolute, rotated at every privilege change, same-origin writes only. Lockout after 5 failures plus a per-address limit; generic errors.
  - **Recovery without email.** Backup codes, a recovery link from another Owner, or the root token from the terminal (`fonderie admin operator recover <email>`) as the break-glass.
  
  `adminToken` remains the machine credential and the break-glass. `operators: false` keeps the token gate. New client methods on `AdminClient` (`session`, `login`, `verify`, `stepUp`, `inviteOperator`, …, and `adminToken` is now optional for cookie use), hooks `useAdminSession` / `useAdminOperators` (React and Vue), an Operators page in both screen packages, and `fonderie admin operator invite|recover|disable|enable`.

## 1.1.0

### Minor Changes

- a2a9a65: A modernized admin console. Same pages, same data, a surface that reads like a product instead of a text document.
  
  - **Shell:** sidebar with the deployment's host and an environment badge (production is tinted), an icon per page, and the session controls (theme, forget token) docked in its footer instead of floating over content. Below 820px the sidebar becomes a drawer behind a top bar. New optional `AdminShell` props: `appName`, `envLabel`, `footer`.
  - **Pages:** a header on every page saying what it answers, with its actions on the right. Tables and lists are framed cards. Status is a pill (ready / error / advice / skipped) rather than a coloured word. Attention opens with summary tiles (needs action, advice, modules ready, routes). Routes filters as you type. Empty states say what would appear.
  - **Served console:** a sign-in card; the page lives in the URL hash, so reload, bookmarks and back work; hover, focus rings and phone padding from the shell stylesheet.
  - **Config and templates screens** match: framed lists, pill status, card forms, consistent controls.
  
  Every colour is still a `--fonderie-*` token with a light fallback (checked against the served bundle), so embedded screens keep rendering without the shell, and there is still no webfont or icon font — icons are inline SVG paths.

## 1.0.3

### Patch Changes

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

## 1.0.2

### Patch Changes

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
- Updated dependencies [cc51775]
  - @fonderie/store@0.7.0

## 1.0.1

### Patch Changes

- Updated dependencies [8e89e7e]
  - @fonderie/core@0.21.0

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

## 0.10.0

### Minor Changes

- 615525d: Theme the admin console with the organisation's design tokens.
  
  The console is the surface an operator judges the product by, and it looked
  assembled: seven files carried their own greys, so the same border was `#ddd`
  on one screen, `#e0e0e0` on another and `#eee` on a third, and the token gate
  shipped a different font stack from the pages behind it.
  
  Colour, type, radii and shadow now come from `var(--fonderie-*)`, declared once
  in the served shell. Two consequences beyond the look:
  
  - **Dark mode works.** It never did — the near-white `#ddd`/`#eee` borders and
    the `#f9fafb` code block would have drawn bright lines and panels on a dark
    page. The shell now ships a dark palette under `prefers-color-scheme`, scoped
    `:root:not([data-theme="light"])` so an explicit light choice still wins.
  - **The surface is themeable.** Override any `--fonderie-*` variable on an
    ancestor and the console follows. The prefix is namespaced deliberately: the
    dashboard can be embedded in a consumer's own page, and a bare `--color-text`
    would collide with theirs silently, and only in their app.
  
  Every variable carries a light-palette fallback, because these screens are
  published packages: imported into an app with no Fonderie shell, an unresolved
  `var(--fonderie-text)` yields nothing at all — invisible text, invisible
  borders. With fallbacks an embedded screen renders correctly and is simply not
  themed.
  
  No webfont is fetched. The tokens name Inter first and fall through to the
  system stack, so an admin console does not announce its existence to a third
  party and still works on an air-gapped deploy.
  
  **Theme switcher.** The console offers System / Light / Dark, the same control
  as the organisation UI (markup, icons and CSS copied from its `.theme-switch`).
  Until now "dark" was decided entirely by the OS: there was no rule for forcing
  dark on a light machine and no way to opt out of dark on a dark one. The shell
  gains `:root[data-theme="dark"]` alongside the existing media query, and the
  choice is stored under a namespaced `fonderie.admin.theme` key — the bare
  `theme` key would read and write a host app's own preference on a shared origin.
  
  "System" is the *absence* of `data-theme`, not a snapshot of the OS resolved at
  click time, so system mode keeps following the machine when it flips at sunset
  rather than freezing until reload. An inline boot script applies a stored choice
  before first paint; if it is blocked or storage throws, the console falls back to
  system — the default either way.
  
  **Chrome moved to the corners.** "Forget token" used to sit in a full-width
  strip above the whole console, which spent a band of vertical space on one
  button and pushed the sidebar down from the top edge. The strip is gone: the
  session control docks bottom-left, the theme switcher bottom-right, and the nav
  now reaches the top of the page.

## 0.9.1

### Patch Changes

- 4e3f341: The admin UI no longer offers a Config page for a brick that is not installed
  
  Clicking "Config & secrets" crashed the dashboard with
  `Uncaught TypeError: a.map is not a function`, alongside a 404 on
  `/_admin/secrets`.
  
  The 404 was the harmless symptom. The crash was a **silent shape collision**:
  the served UI decided whether to show the page by probing the manifest for
  `/_admin/config` — a path `@fonderie/admin` registers ITSELF, as the
  declared-vs-held report. So the probe was true on every deployment. The shell
  built a `ConfigAdminClient`, `listConfig()` fetched `/_admin/config`, got
  **200** carrying admin's report OBJECT where it expected an ARRAY of config
  entries, and the screen died on `.map`.
  
  A 200 with the wrong shape is worse than a 404: nothing reports it.
  
  - The probe is now `/secrets`, which only `@fonderie/config` serves.
  - `useConfigEntries` / `useSecrets` (React and Vue) reject a non-array result
    instead of handing it to a component typed for a list, and say what is
    likely wrong: "is @fonderie/config mounted at this prefix?"
  
  A test in `@fonderie/admin` pins the invariant both ways — that this module
  owns `/_admin/config` (so probing it for another brick is a false positive)
  and does NOT own `/_admin/secrets` (so the new probe stays sound).
  
  **Separately, and NOT fixed here:** `@fonderie/config` describes `/config`,
  which `@fonderie/admin` already owns, so registering both modules fails boot
  with "cannot describe GET /_admin/config". That needs one of the two paths to
  move and is a breaking change for whichever loses.

## 0.9.0

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

## 0.8.3

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

## 0.8.2

### Patch Changes

- Updated dependencies [13b6a15]
  - @fonderie/store@0.6.0

## 0.8.1

### Patch Changes

- 19fddc6: `host` accepts a scheme or a trailing path instead of silently matching nothing
  
  `host` is compared against the request's `Host`, which is a bare hostname with
  an optional port — never a scheme. But the option sits beside config that *is*
  full URLs, so `https://admin.example.com` is the natural slip, and it used to
  go into the allow-set verbatim. It then matched no request at all: every route
  under the prefix answered 404, which is by design indistinguishable from the
  surface never having been mounted. A typo in optional hardening locked the
  operator out of their own dashboard with nothing to read.
  
  `https://admin.example.com`, `http://admin.example.com/`, `admin.example.com/`
  and `admin.example.com` now all name the same host. The boundary is unchanged —
  another hostname is still 404, and an entry given with a port is still exact.

## 0.8.0

### Minor Changes

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

## 0.7.0

### Minor Changes

- 38f2410: `ui: true` — serve the dashboard from the deployment itself
  
  `AdminModule({ ui: true })` serves `@fonderie/react-admin-screens` at
  `GET /_admin/ui`, compiled into one 82 KB-gzipped file that ships in this
  package. A deployment gets the whole operator surface with no frontend
  build and no new dependency — React and the screens are devDependencies
  here, bundled at publish time. Off by default.
  
  The two static routes are unguarded by design: a browser navigating to a
  page cannot send an `Authorization` header, and neither file carries data.
  The page asks for a token, keeps it in `sessionStorage` for that tab only,
  and sends it itself — so every request that reads anything is guarded and
  logged exactly as before. It reads the manifest first and builds a client
  only for bricks that described routes, so pages that would 404 never
  appear. The script path comes from the request, so it is correct under a
  `basePath`, a moved `path`, and a trailing slash.
  
  Phase 7c of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.6.0

### Minor Changes

- 0a5c5c7: Scoped tokens: issue, expire, revoke — without a redeploy
  
  The admin surface had one credential, the configured `adminToken`, and
  handing it to a dashboard meant handing over secret reveal and every
  mutation. Now, with a store and the package's new migration
  (`fonderie_admin_tokens`), the configured token is the **root** and can
  issue scoped tokens: `read` (every GET except under `/secrets`), `write`
  (every mutation, implies read), `secrets` (anything under `/secrets`,
  implies both). The scope a route needs is derived from the route itself.
  
  Only the hash is stored; the plaintext is shown once. A valid token short of
  the scope is 403; unknown, revoked or expired is the same 401 as missing.
  The root is the only credential that can issue or revoke — a scoped token
  can never mint one. In the admin log the actor becomes `token:<name>`.
  `GET /_admin/access/tokens` lists what was issued; `POST` issues, `DELETE
  /:id` revokes. Without a store nothing changes: root only, issuing off.
  Phase 8e of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.5.0

### Minor Changes

- 782cac2: `GET /_admin/config`, `/_admin/routes` and `/_admin/access/tokens` — the rest of Tier 0
  
  - **config**: readiness problems per module, and the *presence* of each
    environment variable the deployment reads — never the value. Bricks never
    read `process.env` (config is injected), so the app names them:
    `AdminModule({ env: [...] })`.
  - **routes**: every route with a guard class — `admin`, `probe`, or `app`.
    Whether an `app` route needs a session is not derivable here, so it is not
    claimed.
  - **access/tokens**: the admin token's readiness verdict, and which bricks
    still register a legacy standalone surface with their own token.
  
  Phase 6 of `docs/ADMIN-BRICK-DESIGN.md`.

## 0.4.0

### Minor Changes

- 159d853: The admin log — every request through the surface, refused ones included
  
  Until now admin actions left no trace: nothing recorded who revealed a
  secret, changed a template or granted credits, and a wrong token was
  invisible. `AdminModule({ store })` and the package's migration add
  `fonderie_admin_log`: actor (`X-Actor`, else `admin-token`), method, path,
  route, module, status, duration, request id, client IP.
  
  The log middleware runs *before* the token guard, so a refused request is
  a row too; a failed write never fails the request it describes.
  `GET /_admin/activity/admin-log` reads it newest first, keyset-paged. The
  manifest reports `admin.log: false` when no store is given, so "not
  recording" is visible.
  
  `@fonderie/store` becomes an optional peer. Phase 5 of
  `docs/ADMIN-BRICK-DESIGN.md`.

## 0.3.0

### Minor Changes

- 2363ea6: `GET /_admin/doctor` and the attention page at `GET /_admin`
  
  The five reconciliation checks from `docs/OPERATIONS.md` had one home: a
  cron route in an example app, reporting through `console.error`. Now every
  brick that describes checks has them run at `/_admin/doctor` — on demand,
  each under `checkTimeoutMs` (default 10 s), a throw turned into a finding,
  never a 500. Two modules offering one check name fail boot, naming both.
  `AdminModule({ checks })` takes the ones no module owns, such as pending
  migrations.
  
  `GET /_admin` is what needs the operator today: readiness problems as
  reported, failed checks as errors, findings on passing checks as advice.
  `ok: true, items: []` is green.

### Patch Changes

- Updated dependencies [2363ea6]
  - @fonderie/core@0.19.0

## 0.2.0

### Minor Changes

- e687c4e: Mount every brick's described admin routes under the prefix
  
  `AdminModule` now reads `app.adminDescriptions()` and mounts each described
  route at `/_admin` + path, behind its own token — so config, courier and
  billing's admin surfaces appear at `/_admin/config`, `/_admin/secrets`,
  `/_admin/templates`, `/_admin/plans` and `/_admin/wallet/grant` with one
  token, whatever each brick's own `adminToken` is set to. Two modules
  describing the same route fail boot, naming both.
  
  The manifest gains `describesAdmin` per module, so a brick that offers
  nothing is distinguishable from one that has not implemented the contract.

### Patch Changes

- Updated dependencies [e687c4e]
  - @fonderie/core@0.18.0

## 0.1.0

### Minor Changes

- 981ee15: New brick: `@fonderie/admin` — the operator's surface
  
  The model that assembled the app knows what is installed, wired and
  configured. The human who deployed it does not, unless they are back in a
  development session and can ask. The answer already existed in core
  (`securityReport()`, `app.routes()`); it had no address.
  
  `AdminModule({ adminToken, path = '/_admin' })` owns one reserved prefix —
  no other module can mount under it, a collision fails boot — behind one
  admin token, fail-closed by absence and strength-checked at boot like every
  other brick's admin surface.
  
  `GET /_admin/manifest`: every registered module with its version (when it
  reports one) and its readiness problems, the aggregate readiness, and the
  full route table with the module that mounted each route. Readiness details
  are shown here in production, unlike the public `/readyz`, because the
  operator is the audience.
  
  Phase 2 of `docs/ADMIN-BRICK-DESIGN.md`. Bricks describing their own admin
  routes and checks (composition, doctor) come next.

### Patch Changes

- Updated dependencies [981ee15]
  - @fonderie/core@0.17.0
