# Hook Gap Audit — 2026-08-22

> ## ✅ Status: RESOLVED — all five remediation phases shipped 2026-08-22
>
> Every finding below was fixed the same day the audit ran, across seven
> releases and three repos. The findings sections are kept verbatim as the
> historical record; the ledger here maps each cluster to its fix.
>
> | Phase | Findings closed | Shipped as | PRs |
> |---|---|---|---|
> | 1 — Stop the bleed | SDK-001/002/003, B-001, B-003, B-004 | `client@0.8.0`, auth pkgs `0.5.0`; app MfaVerifyScreen → `useMfaLogin`, unified 401 logout, refresh-token persistence | #108/#109 |
> | 2 — Fill the holes | B-002, A-101, A-102, A-103, A-104, A-201…A-205, E-005 | `client@0.9.0`, auth `0.6.0`, workspaces `0.3.0` (`useMfaSetup`, `useProfile`, `useChangePassword`, `useAccountData`, `resend()`, `useRolePermissions`, customers pagination); 4 new screens ×3 frameworks; 35 app bypass sites migrated | #110–#114 |
> | 3 — Unify lifecycles | B-005…B-009, C-001…C-005, C-009 | `client@0.10.0` + 17 hook packages: `refresh({force})` everywhere, 10 Group-C hooks folded into self-refreshing list hooks (standalones `@deprecated`); app: MFA token out of Redux (nav param), zero screen-level cache pokes | #115/#116 |
> | 4 — Extract & reuse | A3, C-006/007/008, D1, D2, D3, E-001…E-004, E-006 | App: domain hooks on `useResource`, 6 shared primitives (−326 LOC), dead wrappers deleted; `crewfinding/api`: `/places/*` proxy (key out of the bundle); vue pkgs `0.4–0.8`: reactive params, `onMounted` fetches, exported return types | #117/#119, api `4bdcd6a` |
> | 5 — Prevent regressions | pattern-library enforcement | CI `check:hook-coverage` (128 methods, reasoned allow-list); app ESLint `no-restricted-imports` on `~api` with 10 inline `@skip-hook` exceptions; display helpers → `~utils/customer` | #118, app `fe1368c` |
>
> **Verified end state:** SDK repo-wide typecheck/test/lint green at every
> release; app tsc 503 → 495 (net −8 pre-existing errors fixed), jest 15 →
> 27 tests. Bonus bugs fixed beyond the inventory: cached
> `sendVerificationEmail` swallowing resends, the `IMfaSetupResult` type
> that never matched the server, per-keystroke fetch in the audit screens,
> `useCustomers` pagination `total`, and a latent `.then(refresh)` arity trap.
>
> **Open follow-ups (tracked, out of the audit's scope):**
> - ~~The app calls `/directions` + `/directions/matrix`, but no backend
>   implementation exists anywhere~~ — **resolved 2026-08-22**: proxied behind
>   the API like `/places/*` (crewfinding/api `627f515`).
> - `WorkspacesClient.getWorkspace` / `getRole` remain read-hook-less
>   (allow-listed in `check:hook-coverage` with reasons).
> - ~~`NavigateCard`/`Map` still embed the Google key for map rendering~~ —
>   **resolved 2026-08-22**: NavigateCard moved to `usePlaceSearch` and Map's
>   directions render via the `/directions` proxy + decoded polyline
>   (crewfinding/app `d109cb7`, api `6ac25e1`); both map libraries and the
>   `GOOGLE_MAPS_APIKEY` config removed — no Google key ships in the app.

Systematic audit of hook ↔ API surface gaps and state-lifecycle inconsistencies
across the Fonderie SDK (React, React Native, Vue — 45 hooks, 6 typed
sub-clients, 18 screens packages) and the crewfinding example app (91 raw
`api.*` call sites in 22 files). Every count below was verified by grep, not
estimated.

**At a glance (as found):** 4 critical findings (auth/scoping) · 17 SDK client
methods with no hook · 91 raw `api.*` call sites in app screens · 16 thin
hooks without refresh semantics · ~4,900 lines of pseudo-hook screen code · 2
outright client bugs — **all since resolved; see the ledger above.**

---

## Critical findings — fix before anything else

### [B-001] CRITICAL — MFA login never persists the session token
- **Location:** `examples/crewfinding/app/src/app/(public)/MfaVerifyScreen.view.tsx:33`; SDK has no hook for `auth.mfa.verifyLogin`
- **Current behavior:** normal login (`useLogin`) writes `setAccessToken` + the AsyncStorage `fonderie_access_token` key. MFA completion calls the raw client: the AsyncStorage token is **never written**, and the client token is only armed one Redux tick later.
- **Risk:** any `useSession()` consumer sees an MFA user as logged out after cold start; `useLogout` clears a key MFA logins never set; same-tick requests go out unauthenticated.
- **Fix:** ship `useMfaLogin()` (all 3 frameworks) with the exact `useLogin` persistence block; migrate MfaVerifyScreen. **Effort: S · Shared**

### [B-002] CRITICAL — enabling MFA silently rotates tokens that nothing consumes
- **Location:** `packages/client/src/modules/auth.ts:75` — `mfa.verify` returns `IMfaEnabledResult {tokens, user}`
- **Gap:** zero hook coverage in any framework; no caller persists the fresh pair, so every framework keeps the stale session after enrollment.
- **Fix:** `useMfaSetup()` covering setup → verify (persisting tokens) → disable/regenerateBackupCodes. **Effort: M · Shared**

### [SDK-001] CRITICAL — workspace scoping never reaches audit & webhooks sub-clients
- **Location:** `packages/client/src/client.ts:120-125`
- **Current behavior:** `FonderieClient.setWorkspaceId` propagates to billing/workspaces/customers but omits `this.audit` and `this.webhooks` (both have setters).
- **Risk:** every `useAuditEvents`/`useWebhook*` call hits the caller's *personal* workspace regardless of team selection.
- **Fix:** two lines at client.ts:124. Companion **[SDK-002]**: constructor's `opts.workspaceId` (client.ts:62) is stored but never propagated — route through `setWorkspaceId()`. **Effort: S · Shared**

### [B-003] HIGH — refreshed access tokens are never persisted
- **Location:** `packages/client/src/client.ts:80-103` (`doRefresh`); no SDK hook wires `onTokensChanged → persistToken`
- **Risk:** after a silent 401 refresh, storage still holds the stale token; next cold start restores it.
- **Fix:** wire `onTokensChanged` in `useSession` mount (or export `configureAuthPersistence(client)`). **Effort: S · Shared**

### [B-004] HIGH — 401-triggered logout skips token cleanup & revocation (app)
- **Location:** `app/src/api/fonderie-client.ts:39` — `onAuthError: () => store.dispatch(logOutUser())`
- **Gap:** user-initiated logout revokes server-side + clears AsyncStorage; the 401 path does neither.
- **Fix:** one `performLogout()` path both routes share, always calling `clearToken()`. **Effort: S · RN**

### [SDK-003] HIGH — sign-out leaves the previous user's response cache live
- **Location:** hooks call `auth.setAccessToken(undefined)` (TokenStore only); cache clearing lives on `FonderieClient.setAccessToken` (client.ts:110), which hooks never touch.
- **Risk:** the next user on the same device can be served the previous session's cached responses.
- **Fix:** resolve the root client in sign-out paths, or make `AuthClient.setAccessToken(undefined)` clear the shared cache. **Effort: S · Shared**

---

## Category A — missing hook coverage

### A·SDK — client methods with no hook (any framework)

| ID | Client surface | Uncovered methods | Fix | Effort |
|---|---|---|---|---|
| A-101 | `MfaClient` **0/5** | `setup, verify, verifyLogin, disable, regenerateBackupCodes` — the SDK's own useLogin comments point at verifyLogin but never ship it | `useMfaSetup` + `useMfaLogin` ×3 frameworks | M |
| A-102 | `AuthClient` (9) | `updateProfile, updatePreferences, updateEmail, updatePhone, changePassword, exportData, deleteUser, sendVerificationEmail, refreshTokens` | `useProfile`, `useChangePassword`, `useAccountData`, `useVerifyEmail.resend()` | M |
| A-103 | `WorkspacesClient` (3) | `getWorkspace, getRole, getRolePermissions` — the last is the write-only pair: `useSetRolePermissions` can write what nothing can read (app carries a `// No read hook` comment) | convert to `useRolePermissions(roleId)` read+write, mirroring `useMemberRoles` | S |
| A-104 | `useCustomers` pagination | client accepts `limit/offset`; hook exposes no paging and result has no `total` | add `total` server-side + `loadMore` (mirror `useAuditEvents`) | M |

BillingClient, CustomersClient, WebhooksClient, AuditClient (read), and both
admin clients are 100% covered.

### A·App — hook exists, screen bypasses it (35 sites)

| ID | Cluster | Sites | Detail |
|---|---|---|---|
| A-201 | JobSummaryScreen customer ops | 15 | `get/addAddress/patch×3/setPrimary×3/remove×4/addNote/addTag/removeTag` all raw with manual `reloadCustomer` — every one has an auto-refreshing customer hook |
| A-202 | CustomerDetailScreen | 4 | `delete/blacklist/unblacklist` raw despite `useCustomers` exposing all three; label block hand-rolls `useCustomerLabels` while the file already uses 7 other customer hooks |
| A-203 | Label block copy-pasta | 3+3 | identical getLabels/deleteLabel/optimistic-rollback block duplicated in CustomerDetailScreen and JobSummaryScreen |
| A-204 | Private layout bootstrap | 2 | `_layout.tsx` raw `workspace.list` + `members.list` → Redux, while `useWorkspaces`/`useMembers` serve the same data elsewhere — two bootstrap paths for one state |
| A-205 | ConfirmationScreen resend | 1 | verify goes through `useVerifyEmail`, resend hand-rolled — split lifecycle in one screen |
| A-206 | Create-customer-with-children | 6 | **structural**: sub-resource hooks are keyed by `customerId`, which doesn't exist until after create. Needs `useCreateCustomerWithDetails` or an app `useCustomerDraft` |

### A·App — custom domains with no app-level hook (36 sites)

jobs (12) · estimates (10) · invoices (7) · job-schemas (6) · directions (1) —
every call is inline `useState`/`useEffect`/`useAsyncOperation`; four identical
copies of the same load-resource shape. Fix: `useJobs/useJob`,
`useEstimates/useEstimate`, `useInvoices/useInvoice`, `useActiveJobSchema`,
`useDistanceMatrix` — built on a shared `useResource(fetcher, deps)` primitive.
Bonus: 4 dead wrapper modules (`clients, platform, address, onboarding`, ~150
lines, not even registered in `api/index.ts`) — delete.

---

## Category B — lifecycle divergence

Beyond the criticals above:

| ID | Divergence | Path A | Path B | Fix |
|---|---|---|---|---|
| B-005 | Login vs Register | `useLogin` handles `isMfaRequired` | `useRegister` never does; `requiresVerification` normalized differently → verification gate behaves per entry point | one `completeLogin(payload)` normalizer |
| B-006 | `useLogout` vs `useSession.logout` (SDK ×3) | error → state; doesn't touch `user` | error swallowed; clears `user/isAuthenticated`. Calling useLogout with useSession mounted leaves `isAuthenticated===true` | shared internal; deprecate one |
| B-007 | Force-refresh mechanics (app) | 5 screens: `apiCache.invalidate('/…')` + `refresh()` | others: wrapper `{force:true}` → `bust`; JobScreen has **three** load paths with three error/loading contracts in one file | hooks own `refresh({force})`; unexport apiCache |
| B-008 | Mutation → refresh policy (SDK) | Group A: list hook owns mutation + `await refresh()` (**react-customers = gold standard, all 9 hooks**) | Group C: 10 standalone hooks refresh nothing — `useRemoveMember` forces all 3 TeamMembersScreens to hand-wire `await refresh()`; `usePlanAdmin`, `useUpdateRole`, `useSetRolePermissions`, `useCreateWorkspace`, `useAcceptInvitation`, `useRecordUsage`, `useTestWebhookEndpoint`, admin save/delete ×6 | normalize on the react-customers pattern |
| B-009 | Detail-edit leaves list stale | `useWebhookEndpoint.updateEndpoint` writes response into own state | sibling list `useWebhookEndpoints` never notified | uniform response-write + exposed refresh |

---

## Category C — state leakage

| ID | Leak | Location | Fix |
|---|---|---|---|
| C-001 | **MFA challenge token in Redux** — a credential in the global tree, shuttled screen→screen via `mfaPendingLogin`/`selectMfaToken`/`mfaTokenClear` | `store/reducers/tokens.ts:14` + 4 more files | owned by `useMfaLogin`; delete slice field + 3 action creators |
| C-002 | token→client sync glue: module-level mutables + `store.subscribe`, fires on every action; the *only* thing arming the client on MFA logins | `api/fonderie-client.ts:45-64` | token ownership into auth hooks / provider-level sync |
| C-003 | dual token stores: redux-persist→SecureStore ∥ hook→AsyncStorage; only one written on MFA path | `store/index.ts:26-30` | one owner (hook), Redux reads from it |
| C-004 | `fonderie.clearCache()` driven from Redux thunks | `store/actions/user.ts:40,52` | into login/logout hooks |
| C-005 | screens reaching into the client cache by magic string — 7 `apiCache.invalidate` calls in 5 screens | WorkspaceSwitcher, CustomerScreen, Payment, Roles, Members | `refresh({force})` on hooks; unexport apiCache |
| C-006 | raw AsyncStorage form-draft keys split across two screens (can desync) | CreateJobScreen + FormBuilderScreen | `useJobFormDraft()` |
| C-007 | job timer as screen state; leaf Map component dispatching global nav state after its own fetch | JobSummaryScreen:605 · Map.tsx:61 | `useJobTimer` · `useDistanceMatrix` |
| C-008 | workspace selection bootstrapped in a layout AND a screen — two owners of one slice | `_layout.tsx:20` + WorkspaceSwitcher | `useActiveWorkspace()` |

---

## Category D — abstraction inversion

### Pseudo-hook screens (thick screens)

| Screen | Lines | useState | api sites |
|---|---:|---:|---:|
| JobSummaryScreen | 1,304 | 28 | 31 |
| CustomerDetailScreen | 1,009 | 28 | 13 |
| EstimateDetailScreen | 629 | 11 | 10 |
| JobScreen | 336 | 6 | 7 |
| + 8 more (MfaSetup, Create\* screens, RoleDetail, FormBuilder, InvoiceDetail…) | ~1,600 | — | ~15 |

### Copy-pasted hook-shaped logic

- **8×** "clear API error when form edits" blocks (~150 lines) → `useDismissErrorOnEdit`
- **6×** byte-identical skip-first-focus refetch guards (+3 unguarded variants that double-fetch on mount) → `useRefreshOnFocus`
- **4×** search debounce (two delays, three cleanup styles) → `useDebouncedValue`
- **4×** pull-to-refresh boolean plumbing → `usePullToRefresh`
- **3×** screens shadowing hook `isLoading` with a local `isActing`

### Thin hooks (SDK) & dead wrappers (app)

16 SDK hooks add nothing beyond loading/error and refresh nothing (see B-008
Group C) — fold into their list-hook siblings. App: 4 dead wrapper modules +
~24 dead wrapper methods; two competing force-refresh helpers inside the
wrapper layer; one archived screen calls a method that doesn't exist
(`api.user.update`).

---

## Category E — cross-framework drift

| ID | Drift | Detail | Fix |
|---|---|---|---|
| E-001 | **HIGH** Vue params not reactive | `usePlan(planId)`, `useCustomer(id)`, `useAuditEvents(filters)`… read args once at setup; React versions refetch on change. The vue-audit comment says "call refresh() with new filters" — but `refresh()` takes no arguments | `MaybeRefOrGetter` + `watch` |
| E-002 | Vue fetches during setup, unguarded | all ~20 fetching composables fire synchronously in `setup()` → runs during SSR | `onMounted` guard |
| E-003 | Vue exports no return types | React exports 7+ `IUse*Return` interfaces per package; Vue exports zero (a few declared, none re-exported) | declare + re-export `Ref<>`-typed interfaces |
| E-004 | Audit/customers screens: fetch-per-keystroke (React/RN) vs submit-driven (Vue) | filter state feeds the hook's JSON-stringify memo directly; the React "Filter" button is redundant | committed-filter state or debounce; match Vue |
| E-005 | Missing screens, all frameworks equally | no ResetPassword, VerifyEmail, MfaChallenge, AcceptInvitation screens — each is a shipped hook's dead-end step 2. Screens consume only 22 of 45 hooks | Phase 2/4 additions |
| E-006 | App: Google Places key in the bundle | 3 separate fetch/library integrations + map key prop; distance-matrix already proxied through the backend but autocomplete isn't | backend `/places/*` proxy + `usePlaceSearch()` |
| E-007 | Cosmetic | vue-audit-screens lacks styles.ts; react-native-customers re-export lacks the explanatory comment its siblings carry | trivial |

---

## Summary dashboard

| Category | SDK | App | Highest severity |
|---|---|---|---|
| A — missing coverage | 17 methods (5 MFA, 9 auth-account, 3 workspace reads) | 35 bypass sites + 36 custom-domain sites + 1 structural | CRITICAL (MFA) |
| B — lifecycle divergence | 4 (token persistence ×2, logout dup, refresh policy ×10 hooks) | 5 (MFA persist, 401-logout, login-vs-register, force-refresh, triple-load) | CRITICAL |
| C — state leakage | — | 8 clusters (credential-in-Redux, dual token stores, cache pokes…) | HIGH |
| D — abstraction inversion | 16 thin hooks | 12 pseudo-hook screens (~4,900 L), 22 duplicated blocks, 4 dead modules | MEDIUM |
| E — cross-framework drift | 3 systematic Vue asymmetries, 1 behavior drift, 4 missing screens | Places key ×4 integrations | HIGH |

**High-risk clusters:** the auth/MFA flow concentrates 6 findings (B-001,
B-002, B-003, B-004, A-101, C-001/002/003) — every one traceable to "the hook
owns step 1 but not step 2". Workspace scoping holds both client bugs
(SDK-001/002). Sign-out privacy (SDK-003 + B-004) is the third cluster.

**Quick wins (small effort, high risk):** SDK-001/002 (two lines), B-004 (one
shared logout path), B-003 (wire onTokensChanged), A-103 (useRolePermissions),
fold `removeMember` into `useMembers`, `useVerifyEmail.resend()`, E-004
keystroke fix.

**Structural fixes:** useMfa\* family, refresh-policy normalization to the
react-customers pattern, app custom-domain hooks on a `useResource` primitive,
Vue reactivity model, lint enforcement.

---

## Remediation roadmap

- **Phase 1 — Stop the bleed:** fix SDK-001/002 (workspace scoping), ship
  `useMfaLogin` + migrate MfaVerifyScreen (B-001), unify the app's logout
  paths (B-004), wire refresh-token persistence (B-003), clear cache on
  sign-out (SDK-003). Adopt the review rule now: *no raw `api.*` call in a
  screen without a `// @skip-hook <reason>` comment.*
- **Phase 2 — Fill the holes:** SDK: `useMfaSetup`, `useProfile` /
  `useChangePassword` / `useAccountData`, `useVerifyEmail.resend`,
  `useRolePermissions`, `useCustomers` pagination — each following the
  react-customers state/persistence/error pattern, re-exported types included.
  App: migrate the 35 bypass sites; add ResetPassword/VerifyEmail/
  MfaChallenge/AcceptInvitation screens to the screens packages.
- **Phase 3 — Unify lifecycles:** normalize B-008: every list hook owns its
  mutations + `refresh({force})`; deprecate the 10 Group-C thin hooks; delete
  screen-level `apiCache.invalidate` and wrapper `{force}` plumbing. Move the
  MFA token out of Redux (C-001…C-003); single token owner; `completeLogin`
  normalizer for login/register/MFA.
- **Phase 4 — Extract & reuse:** app: `useJobs/useEstimates/useInvoices/
  useActiveJobSchema` on a shared `useResource`; shared primitives
  `useRefreshOnFocus`, `useDebouncedValue`, `usePullToRefresh`,
  `useDismissErrorOnEdit`, `useJobFormDraft`, `useJobTimer`; delete dead
  wrapper modules; Places backend proxy (E-006). SDK: Vue reactivity + SSR
  guards + exported return types (E-001…003).
- **Phase 5 — Prevent regressions:** ESLint: screens may import from `hooks/`
  only — `no-restricted-imports` on `~api` & `~api/fonderie-client` in
  `src/app/**` and `src/components/**`, override only via the documented
  `@skip-hook` escape. SDK CI: coverage test asserting every public client
  method is referenced by ≥1 hook or explicitly allow-listed.

---

## Pattern library

1. **Token rule:** any client method whose result contains `tokens` must be
   reachable only through a hook that runs the canonical persistence block
   (`setAccessToken` + `persistToken`). Grep-testable: `tokens` in a result
   type ⇒ named hook in the same PR.
2. **Lifecycle rule:** if a flow has more than one step, one hook owns all
   steps. No screen holds intermediate credentials (MFA tokens, reset PINs) in
   Redux, route params, or local state — the hook carries them, with an
   optional explicit-token escape hatch for cross-screen flows.
3. **Refresh rule:** the list hook owns its resource's mutations and refreshes
   itself (`await refresh()` or response-write — pick per resource, never
   both). Screens never call `apiCache.invalidate`; force-refresh is
   `refresh({force:true})`.
4. **Re-export rule:** every client symbol a hook's public API surfaces
   (types, guards, errors) is re-exported from the hook package's index in the
   same PR — one import per package.
5. **Screen rule:** screens import hooks, never `api/*` or the client. A
   justified exception carries `// @skip-hook: <reason>` and shows up in
   review. Custom product domains get app-level hooks built on `useResource`,
   not per-screen state plumbing.
6. **Mirror rule:** react-native-\* stays a pure re-export unless platform
   storage forces a fork (auth only); Vue mirrors expose the same reactive
   contract (params re-fetch on change, return types exported) — a comment
   saying "call refresh yourself" is a bug report, not documentation.

---

*Sources: full-depth sweeps of `packages/*` (45 hooks, 6 sub-clients, 18
screens packages, 2 admin surfaces) and `examples/crewfinding/app` (91 call
sites, 22 files), 2026-08-22.*
