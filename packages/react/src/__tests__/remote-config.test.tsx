import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { ConfigClient, IRemoteConfigState } from '@fonderie/client';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useFlag, useRemoteConfig } from '../hooks';

function fakeConfig(values: Record<string, unknown> | null) {
	let loads = 0;
	const state: IRemoteConfigState = {
		values: values ?? {},
		loadedAt: values ? new Date() : null,
		isLoading: false,
		error: null,
	};
	const client = {
		snapshot: () => state,
		subscribe: () => () => {},
		load: async () => {
			loads++;
			return state;
		},
		get: <T,>(key: string, fallback: T): T => (Object.hasOwn(state.values, key) ? (state.values[key] as T) : fallback),
	} as unknown as ConfigClient;
	return { client, loads: () => loads };
}

function Flag({ client }: { client: ConfigClient }) {
	const on = useFlag('ENABLE_JOB_LISTING', false, client);
	return createElement('span', null, on ? 'jobs-on' : 'jobs-off');
}

test('useFlag renders the loaded value', () => {
	const { client } = fakeConfig({ ENABLE_JOB_LISTING: true });
	assert.match(renderToString(createElement(Flag, { client })), /jobs-on/);
});

test('useFlag renders the SAFE fallback until the snapshot has the key', () => {
	const { client } = fakeConfig(null);
	assert.match(renderToString(createElement(Flag, { client })), /jobs-off/);
});

test('useRemoteConfig exposes the shared state and a refresh', () => {
	const { client } = fakeConfig({ MAX_ACTIVE_JOBS: 3 });
	let seen: ReturnType<typeof useRemoteConfig> | undefined;
	function Probe() {
		seen = useRemoteConfig({}, client);
		return null;
	}
	renderToString(createElement(Probe));
	assert.deepEqual(seen?.values, { MAX_ACTIVE_JOBS: 3 });
	assert.equal(typeof seen?.refresh, 'function');
});
