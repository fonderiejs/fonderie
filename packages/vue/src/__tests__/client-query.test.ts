import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { FonderieClient } from '@fonderie/client';
import { effectScope, nextTick, ref, watch } from 'vue';

import { useClientQuery } from '../composables/useClientQuery';

// The Vue twin of react's client-query test: what the user sees, frame by frame.
const flush = async () => {
	for (let i = 0; i < 5; i++) await nextTick();
};

function track<T>(q: ReturnType<typeof useClientQuery<T>>) {
	const frames: Array<{ data: unknown; isLoading: boolean }> = [];
	watch(
		() => [q.data.value, q.isLoading.value] as const,
		([data, isLoading]) => frames.push({ data, isLoading }),
		{ immediate: true, flush: 'sync' },
	);
	return frames;
}

test('a second read opens on the data with no request and no spinner', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	let calls = 0;
	const fetcher = async () => {
		calls++;
		return { plan: 'pro' };
	};
	const s1 = effectScope();
	s1.run(() => useClientQuery(client.billing, () => 'GET /billing/subscription::ws=w1', fetcher));
	await flush();
	s1.stop();

	const s2 = effectScope();
	const frames = s2.run(() => track(useClientQuery(client.billing, () => 'GET /billing/subscription::ws=w1', fetcher)))!;
	await flush();
	assert.deepEqual(frames[0], { data: { plan: 'pro' }, isLoading: false });
	assert.equal(frames.some((f) => f.isLoading), false);
	assert.equal(calls, 1);
	s2.stop();
});

test('refresh with an unchanged answer keeps the same object and never shows loading', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	const scope = effectScope();
	const { q, frames } = scope.run(() => {
		const q = useClientQuery(client.billing, () => 'k', async () => ({ items: [1, 2] }));
		return { q, frames: track(q) };
	})!;
	await flush();
	const shown = q.data.value;
	await q.refresh();
	await flush();
	assert.equal(q.data.value, shown);
	assert.equal(frames.slice(frames.findIndex((f) => f.data === shown)).some((f) => f.isLoading), false);
	scope.stop();
});

test('a key change (workspace switch) reads the new key; a failed first fetch is not retried in a loop', async () => {
	const client = new FonderieClient({ baseUrl: 'http://localhost' });
	const ws = ref('w1');
	let calls = 0;
	const scope = effectScope();
	const q = scope.run(() =>
		useClientQuery(client.billing, () => `k::ws=${ws.value}`, async () => {
			calls++;
			if (ws.value === 'w2') throw new Error('offline');
			return { ws: ws.value };
		}),
	)!;
	await flush();
	assert.deepEqual(q.data.value, { ws: 'w1' });
	ws.value = 'w2';
	await flush();
	await flush();
	assert.equal(q.data.value, undefined, 'w1 data does not show under w2');
	assert.equal(q.isLoading.value, false, 'the error shows, not an endless spinner');
	assert.equal(calls, 2);
	scope.stop();
});
