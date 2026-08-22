import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { AuthClient, FonderieClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useLogin } from '../composables/useLogin';

const fakeAuth = { marker: 'context-auth' } as unknown as AuthClient;
const fakeClient = { auth: fakeAuth } as unknown as FonderieClient;

// Renders `run` inside a component's setup(), capturing its value or error.
async function runInSetup<T>(run: () => T, plugin?: boolean) {
	let value: T | undefined;
	let error: unknown;
	const Root = defineComponent({
		setup() {
			try {
				value = run();
			} catch (err) {
				error = err;
			}
			return () => h('div');
		},
	});
	const app = createSSRApp(Root);
	if (plugin) app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return { value, error };
}

test('useLogin resolves the auth client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useLogin(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.login, 'function');
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
	assert.equal(value.data.value, null);
});

test('useLogin accepts an explicit client without any plugin installed', async () => {
	const { value, error } = await runInSetup(() => useLogin(fakeAuth));
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(typeof value.login, 'function');
	assert.equal(value.isLoading.value, false);
});

test('useLogin throws without a plugin or explicit client', async () => {
	const { error } = await runInSetup(() => useLogin());
	assert.match(String(error), /useLogin: no client/);
});
