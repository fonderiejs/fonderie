# @fonderie/react

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
