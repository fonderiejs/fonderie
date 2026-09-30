# @fonderie/react

Shared React context for Fonderie. Provide one `FonderieClient` at the app
root; every `@fonderie/react-*` hook then resolves it from context — no client
argument at call sites.

```tsx
import { FonderieClient, createMemoryCache } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { useLogin } from '@fonderie/react-auth';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1', cache: createMemoryCache() });

function App() {
	return (
		<FonderieProvider client={client}>
			<Router />
		</FonderieProvider>
	);
}

function LoginForm() {
	const { login, isLoading, error } = useLogin(); // resolved from context
	// ...
}
```

Passing a client explicitly still works everywhere and always wins over
context — useful in tests and multi-client apps:

```tsx
const { login } = useLogin(otherClient.auth);
```

## API

- `FonderieProvider` — `{ client: FonderieClient, children }`.
- `useFonderieClient()` — the context client; throws if no provider is mounted.
- `useFonderieSubClient(explicit, select, hookName)` — resolution helper used
  by the `@fonderie/react-*` hook packages: explicit argument wins, otherwise
  select from the context client, otherwise throw a `hookName`-prefixed error.

- `useRemoteConfig(key, fallback)` — one public remote-config value
  (`ConfigModule` `publicKeys`). **Always live**: the first reader opens the
  shared stream (`@fonderie/sse`), a change in the admin re-renders exactly the
  components whose key changed, the last reader closes it. No polling, nothing
  to opt into. Never waits: it returns the last answer, the value restored from
  the device (`new FonderieClient({ config: { storage } })`), or `fallback`. A
  key the server does not expose warns once.
- `withRemoteConfig(key, Component, { off?, fallback? })` — render a screen
  only while a boolean key is on, `off` (e.g. "coming soon") otherwise; flips
  live. To gate a whole **screen**, pass `fallback: true` so no screen is
  unavailable for lack of signal.

```tsx
const message = useRemoteConfig('MAINTENANCE_MESSAGE', '');
export default withRemoteConfig('WITH_JOBS_SCREEN', JobsScreen, { off: ComingSoon, fallback: true });
```
- `useSse(topics, onEvent, { onReset })` — Server-Sent Events from
  `@fonderie/sse` (`'*'`, exact types, `prefix.*`), one connection shared by
  all components. Events are invalidations: refetch what changed. Additive —
  never gate rendering on it.

React Native apps use this same package — it is plain React context with no
DOM dependency. For streaming, construct the client with Expo's fetch:
`new FonderieClient({ baseUrl, sse: { fetch } })` (`import { fetch } from 'expo/fetch'`),
and call `client.sse.pause()` / `resume()` from `AppState` changes.
