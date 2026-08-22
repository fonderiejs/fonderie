import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { FonderiePlugin, provideFonderie, useFonderieClient, useFonderieSubClient } from '../provider';

const fakeAuth = { marker: 'context-auth' };
const fakeClient = { auth: fakeAuth } as unknown as FonderieClient;

// Renders `run` inside a component's setup(), capturing its value or error.
async function runInSetup<T>(run: () => T, plugin?: boolean, root?: () => void) {
	let value: T | undefined;
	let error: unknown;
	const Child = defineComponent({
		setup() {
			try {
				value = run();
			} catch (err) {
				error = err;
			}
			return () => h('div');
		},
	});
	const Root = defineComponent({
		setup() {
			root?.();
			return () => h(Child);
		},
	});
	const app = createSSRApp(Root);
	if (plugin) app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return { value, error };
}

test('useFonderieClient resolves via provideFonderie in a parent setup', async () => {
	const { value, error } = await runInSetup(
		() => useFonderieClient(),
		false,
		() => provideFonderie(fakeClient),
	);
	assert.equal(error, undefined);
	assert.equal(value, fakeClient);
});

test('useFonderieClient resolves via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useFonderieClient(), true);
	assert.equal(error, undefined);
	assert.equal(value, fakeClient);
});

test('useFonderieClient throws without a provider', async () => {
	const { error } = await runInSetup(() => useFonderieClient());
	assert.match(String(error), /provideFonderie/);
});

test('useFonderieSubClient falls back to the injected client', async () => {
	const { value, error } = await runInSetup(
		() => useFonderieSubClient(undefined, (c) => (c as unknown as { auth: unknown }).auth, 'useProbe'),
		true,
	);
	assert.equal(error, undefined);
	assert.equal(value, fakeAuth);
});

test('useFonderieSubClient prefers the explicit argument over context', async () => {
	const override = { marker: 'explicit-auth' };
	const { value, error } = await runInSetup(
		() => useFonderieSubClient(override, (c) => (c as unknown as { auth: unknown }).auth, 'useProbe'),
		true,
	);
	assert.equal(error, undefined);
	assert.equal(value, override);
});

test('useFonderieSubClient throws a composable-named error when neither is present', async () => {
	const { error } = await runInSetup(() =>
		useFonderieSubClient(undefined, (c) => (c as unknown as { auth: unknown }).auth, 'useProbe'),
	);
	assert.match(String(error), /useProbe: no client/);
});
