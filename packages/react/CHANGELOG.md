# @fonderie/react

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
