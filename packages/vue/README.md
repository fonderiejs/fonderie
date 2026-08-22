# @fonderie/vue

Shared Vue 3 provide/inject for Fonderie. Provide one `FonderieClient` at the
app root; every `@fonderie/vue-*` composable then resolves it by injection —
no client argument at call sites.

```ts
import { createApp } from 'vue';
import { FonderieClient, createMemoryCache } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1', cache: createMemoryCache() });

createApp(App).use(FonderiePlugin, client).mount('#app');
```

```vue
<script setup lang="ts">
import { useLogin } from '@fonderie/vue-auth';

const { login, isLoading, error } = useLogin(); // resolved by injection
</script>
```

Alternatively call `provideFonderie(client)` inside the root component's
`setup()`. Passing a client explicitly still works everywhere and always wins
over injection — useful in tests and multi-client apps.

## API

- `FonderiePlugin` — `app.use(FonderiePlugin, client)`.
- `provideFonderie(client)` — provide from within a `setup()`.
- `useFonderieClient()` — the injected client; throws if none was provided.
- `FONDERIE_INJECTION_KEY` — the typed `InjectionKey<FonderieClient>`.
- `useFonderieSubClient(explicit, select, composableName)` — resolution helper
  used by the `@fonderie/vue-*` composable packages: explicit argument wins,
  otherwise select from the injected client, otherwise throw a named error.
