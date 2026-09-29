---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
---

Client side of realtime delivery, step 5 of `docs/REALTIME-DESIGN.md`.

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
