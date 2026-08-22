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

React Native apps use this same package — it is plain React context with no
DOM dependency.
