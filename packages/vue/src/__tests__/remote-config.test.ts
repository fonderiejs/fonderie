import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { ConfigClient, IRemoteConfigState } from '@fonderie/client';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useFlag, useRemoteConfig } from '../composables';

function fakeConfig(values: Record<string, unknown> | null) {
	let loads = 0;
	const state: IRemoteConfigState = { values: values ?? {}, loadedAt: values ? new Date() : null, isLoading: false, error: null };
	const client = {
		snapshot: () => state,
		subscribe: () => () => {},
		load: async () => {
			loads++;
			return state;
		},
		get: <T>(key: string, fallback: T): T => (Object.hasOwn(state.values, key) ? (state.values[key] as T) : fallback),
	} as unknown as ConfigClient;
	return { client, loads: () => loads };
}

async function render(client: ConfigClient) {
	const App = defineComponent({
		setup() {
			const on = useFlag('ENABLE_JOB_LISTING', false, client);
			return () => h('span', on.value ? 'jobs-on' : 'jobs-off');
		},
	});
	return renderToString(createSSRApp(App));
}

test('useFlag renders the loaded value', async () => {
	assert.match(await render(fakeConfig({ ENABLE_JOB_LISTING: true }).client), /jobs-on/);
});

test('useFlag renders the SAFE fallback before a load, and triggers one', async () => {
	const fake = fakeConfig(null);
	assert.match(await render(fake.client), /jobs-off/);
	assert.ok(fake.loads() >= 1, 'first use loads the snapshot');
});

test('useRemoteConfig exposes values and a refresh', async () => {
	const { client } = fakeConfig({ MAX_ACTIVE_JOBS: 3 });
	let values: unknown;
	const App = defineComponent({
		setup() {
			const rc = useRemoteConfig({}, client);
			values = rc.values.value;
			return () => h('div');
		},
	});
	await renderToString(createSSRApp(App));
	assert.deepEqual(values, { MAX_ACTIVE_JOBS: 3 });
});
