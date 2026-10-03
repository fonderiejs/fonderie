---
'@fonderie/client': minor
'@fonderie/react': minor
'@fonderie/vue': minor
'@fonderie/react-billing': minor
'@fonderie/vue-billing': minor
---

**Screens open on their data, not on a spinner — and a refresh never flickers.** Every hook used to start each mount with no data and `isLoading: true`, then wait for the network, even for data the previous screen had just fetched. A refresh that came back with the same answer still replaced the screen's data. The client's response cache could not help: it honours the server's `Cache-Control`, and an API answering `max-age=0` is cached for 0 ms.

- `@fonderie/client`: `client.queries`, one shared read model per client (`QueryStore`). Fetched answers can be read synchronously and are observed by every screen showing them. A fetch happens only when an answer is missing or older than `staleMs` (option `queries: { staleMs }`, default 5 minutes; `Infinity` = only when asked), or on an explicit refresh. A refresh never removes data, and an answer equal to what is shown keeps the same object. A failed refresh keeps the data and reports the error. A write marks the reads under its resource stale (the same fragments the HTTP cache evicts), so screens showing them refetch in the background. Sign-out and revocation clear it.
- `@fonderie/react` / `@fonderie/vue`: `useClientQuery(source, key, fetcher)`, the one way a hook reads server data. `isLoading` means "nothing to show yet", never "a refresh is running" (that is `isFetching`). In Vue, requests wait for mount, so SSR never fetches.
- `@fonderie/react-billing` / `@fonderie/vue-billing`: every read (`useSubscription`, `usePaymentMethod`, `useInvoices`, `useUsage`, `useWallet`, `useWalletTransactions`, `useWalletPreferences`, `usePlans`, `usePlan`) goes through it. Returning to a screen, or switching back to a workspace already seen, shows its data on the first frame with no request. `useWallet` and `useWalletPreferences` share one request. Pages loaded with `loadMore` survive a refresh that returns the same first page. Return shapes are unchanged. Two behaviour differences: a failed refresh now keeps the last data shown instead of clearing it, and `refresh()` always bypasses the HTTP cache.

`@fonderie/react-native-billing` re-exports `@fonderie/react-billing`, so React Native apps get this too.
