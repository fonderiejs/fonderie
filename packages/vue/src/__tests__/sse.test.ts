import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ConfigClient, IRemoteConfigState, SseClient } from '@fonderie/client';
import { effectScope, ref } from 'vue';

import { useRemoteConfig, useSse, useSseStatus } from '../composables';

function fakeSse() {
	const calls: Array<{ topics: string[]; stopped: boolean }> = [];
	const sse = {
		subscribe(topics: string[]) {
			const call = { topics, stopped: false };
			calls.push(call);
			return () => {
				call.stopped = true;
			};
		},
	} as unknown as SseClient;
	return { sse, calls };
}

test('useSse: subscribes while the scope lives, unsubscribes on dispose', () => {
	const { sse, calls } = fakeSse();
	const scope = effectScope();
	scope.run(() => useSse(['fonderie.customer.*'], () => {}, {}, sse));
	assert.deepEqual(calls.map((c) => [c.topics, c.stopped]), [[['fonderie.customer.*'], false]]);
	scope.stop();
	assert.equal(calls[0]!.stopped, true);
});

test('useSse: a reactive topic list re-subscribes when it changes', async () => {
	const { sse, calls } = fakeSse();
	const topics = ref(['a.b']);
	const scope = effectScope();
	scope.run(() => useSse(topics, () => {}, {}, sse));
	topics.value = ['a.b', 'c.*'];
	await Promise.resolve();
	assert.deepEqual(calls.map((c) => c.topics), [['a.b'], ['a.b', 'c.*']]);
	assert.equal(calls[0]!.stopped, true, 'the old subscription is released');
	scope.stop();
});

test('useRemoteConfig({ watch: true }): watches while alive, releases on dispose', () => {
	let watching = 0;
	const state: IRemoteConfigState = { values: {}, loadedAt: new Date(), isLoading: false, error: null };
	const config = {
		snapshot: () => state,
		subscribe: () => () => {},
		load: async () => state,
		watch: () => {
			watching++;
			return () => {
				watching--;
			};
		},
	} as unknown as ConfigClient;
	const scope = effectScope();
	scope.run(() => useRemoteConfig({ watch: true }, config));
	assert.equal(watching, 1);
	scope.stop();
	assert.equal(watching, 0);
	const quiet = effectScope();
	quiet.run(() => useRemoteConfig({}, config));
	assert.equal(watching, 0, 'no watch unless asked');
	quiet.stop();
});

test('useSseStatus: follows the connection state, stops listening on dispose', () => {
	let listener: ((s: string) => void) | undefined;
	const sse = {
		status: 'connecting',
		onStatus(l: (s: string) => void) {
			listener = l;
			return () => {
				listener = undefined;
			};
		},
	} as unknown as SseClient;
	const scope = effectScope();
	const status = scope.run(() => useSseStatus(sse))!;
	assert.equal(status.value, 'connecting');
	listener!('open');
	assert.equal(status.value, 'open');
	scope.stop();
	assert.equal(listener, undefined);
});
