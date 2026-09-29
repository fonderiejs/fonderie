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

- `useRemoteConfig({ refreshMs?, watch? })` — the public remote config
  (`GET /config/public`), one snapshot shared by every component. `watch: true`
  re-loads when the server pushes a change (`@fonderie/sse`).
- `useFlag(key, fallback)` — one value. For a sub-feature pass the safe
  fallback (off); to gate a whole **screen**, fall back to showing it and seed
  saved values with `client.config.hydrate()` so no screen depends on signal.
- `useSse(topics, onEvent, { onReset })` — Server-Sent Events from
  `@fonderie/sse` (`'*'`, exact types, `prefix.*`), one connection shared by
  all components. Events are invalidations: refetch what changed. Additive —
  never gate rendering on it.

React Native apps use this same package — it is plain React context with no
DOM dependency. For streaming, construct the client with Expo's fetch:
`new FonderieClient({ baseUrl, sse: { fetch } })` (`import { fetch } from 'expo/fetch'`),
and call `client.sse.pause()` / `resume()` from `AppState` changes.
