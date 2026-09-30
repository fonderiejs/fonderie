---
'@fonderie/client': major
'@fonderie/react': minor
'@fonderie/vue': minor
---

Remote config has one read path, and it is always live.

**The problem:** there were seven ways to read remote config. Reactivity was opt-in everywhere, and the one keyed API, `useFlag`, loaded once and never updated. Apps added polling on top, plus their own persisted copies for offline starts.

**Now:**

- **`useRemoteConfig(key, fallback)`** (React and Vue) reads one key. It re-renders only when that key's value changes. The first mounted reader opens the shared `@fonderie/sse` stream and loads; the last one closes it. There is no polling and nothing to opt into. Every (re)connect re-reads, so changes missed while the stream was down still arrive.
- **`withRemoteConfig(key, Component, { off, fallback })`** (React and Vue) renders a screen only while a boolean key is on, and `off` (for example "coming soon") otherwise. It flips live.
- **`new FonderieClient({ config: { storage } })`** keeps the last answer on the device (AsyncStorage, localStorage) and restores it before the first render. Hold that render on `client.config.ready`. A cold start with no signal decides from last-known values.
- **A key the server does not expose warns once** (usually a typo, or a key missing from `publicKeys`), through the new client `log` option (default `console`). Stream-unavailable warnings go through `log` too.

**Breaking:**

- Removed: `useFlag`, `useRemoteConfig({ refreshMs, watch })`, `IUseRemoteConfigOptions`/`IUseRemoteConfigReturn`, `client.config.watch()` and `client.config.hydrate()`.
- Migrate `useFlag(k, f)` to `useRemoteConfig(k, f)`, and a screen gate to `withRemoteConfig`. Replace app-side config persistence with `config.storage`.
- `ConfigClient.retain()` is the ref-counted engine behind the bindings; apps don't call it.
