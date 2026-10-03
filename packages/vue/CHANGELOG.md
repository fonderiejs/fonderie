# @fonderie/vue

## 0.7.0

### Minor Changes

- 157004a: **Screens open on their data, not on a spinner — and a refresh never flickers.** Every hook used to start each mount with no data and `isLoading: true`, then wait for the network, even for data the previous screen had just fetched. A refresh that came back with the same answer still replaced the screen's data. The client's response cache could not help: it honours the server's `Cache-Control`, and an API answering `max-age=0` is cached for 0 ms.
  
  - `@fonderie/client`: `client.queries`, one shared read model per client (`QueryStore`). Fetched answers can be read synchronously and are observed by every screen showing them. A fetch happens only when an answer is missing or older than `staleMs` (option `queries: { staleMs }`, default 5 minutes; `Infinity` = only when asked), or on an explicit refresh. A refresh never removes data, and an answer equal to what is shown keeps the same object. A failed refresh keeps the data and reports the error. A write marks the reads under its resource stale (the same fragments the HTTP cache evicts), so screens showing them refetch in the background. Sign-out and revocation clear it.
  - `@fonderie/react` / `@fonderie/vue`: `useClientQuery(source, key, fetcher)`, the one way a hook reads server data. `isLoading` means "nothing to show yet", never "a refresh is running" (that is `isFetching`). In Vue, requests wait for mount, so SSR never fetches.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: every read (`useSubscription`, `usePaymentMethod`, `useInvoices`, `useUsage`, `useWallet`, `useWalletTransactions`, `useWalletPreferences`, `usePlans`, `usePlan`) goes through it. Returning to a screen, or switching back to a workspace already seen, shows its data on the first frame with no request. `useWallet` and `useWalletPreferences` share one request. Pages loaded with `loadMore` survive a refresh that returns the same first page. Return shapes are unchanged. Two behaviour differences: a failed refresh now keeps the last data shown instead of clearing it, and `refresh()` always bypasses the HTTP cache.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0

## 0.6.0

### Minor Changes

- 87f6e1d: **Billing screens follow a workspace switch.** With workspace billing the subscriber is the selected workspace, but the billing hooks only loaded on mount — a screen that stayed open across a switch kept showing the previous workspace's subscription, card, invoices or wallet.
  
  - `@fonderie/client`: `client.getWorkspaceId()` and `client.onWorkspaceChange(listener)` (returns an unsubscribe); the billing sub-client has the same pair. Listeners fire only when the id actually changes.
  - `@fonderie/react` / `@fonderie/vue`: `useWorkspaceId(source?)` — the current workspace id, re-rendering (React) or as a Ref (Vue) when it changes. Follows the provided client, or the sub-client you pass.
  - `@fonderie/react-billing` / `@fonderie/vue-billing`: `useSubscription`, `usePaymentMethod`, `useInvoices`, `useWallet`, `useWalletTransactions`, `useWalletPreferences` and `useUsage` clear what they showed and re-read on a switch, and a slow answer for the previous workspace can no longer land on top of the new one. `usePlans` / `usePlan` are not per-workspace and are unchanged.
  
  `@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0

## 0.5.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0

## 0.5.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.

## 0.5.1

### Patch Changes

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
- Updated dependencies [3b6ca87]
  - @fonderie/client@2.5.0

## 0.5.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [68393a7]
  - @fonderie/client@2.0.0

## 0.4.0

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

### Patch Changes

- Updated dependencies [72f93d7]
  - @fonderie/client@1.15.0

## 0.3.0

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

### Patch Changes

- Updated dependencies [c742537]
  - @fonderie/client@1.4.0

## 0.2.0

### Minor Changes

- f6f54a2: Added context-provider support: configure one FonderieClient at the app root (`<FonderieProvider client={...}>` from `@fonderie/react`, or `app.use(FonderiePlugin, client)` / `provideFonderie(client)` from `@fonderie/vue`) and every hook, composable, and pre-built screen resolves it automatically — `useLogin()` with no argument just works. Passing a client explicitly is still supported everywhere and takes precedence over context, so existing code keeps working unchanged. New packages `@fonderie/react` and `@fonderie/vue` host the shared context.
