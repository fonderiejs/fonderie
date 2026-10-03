import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FonderieClient, QueryStore, deepEqual, queryStoreFor } from '../index';

// The rules every screen's data follows (query-store.ts). Each test is one
// rule, stated as the user would notice it breaking.

function counter<T>(answers: T[]) {
	let i = 0;
	const fetcher = async () => {
		const a = answers[Math.min(i, answers.length - 1)] as T;
		i++;
		return a;
	};
	return { fetcher, calls: () => i };
}

test('a screen shown again within the staleness window does not touch the network', async () => {
	const store = new QueryStore({ staleMs: 60_000 });
	const f = counter([{ plan: 'pro' }]);
	await store.fetch('/billing/subscription', f.fetcher);
	await store.fetch('/billing/subscription', f.fetcher);
	assert.equal(f.calls(), 1);
	assert.deepEqual(store.peek('/billing/subscription').data, { plan: 'pro' });
});

test('pull-to-refresh (force) always fetches', async () => {
	const store = new QueryStore({ staleMs: Infinity });
	const f = counter([{ n: 1 }, { n: 2 }]);
	await store.fetch('k', f.fetcher);
	await store.fetch('k', f.fetcher, { force: true });
	assert.equal(f.calls(), 2);
	assert.deepEqual(store.peek('k').data, { n: 2 });
});

test('an answer equal to what is shown keeps the SAME object — nothing re-renders its content', async () => {
	const store = new QueryStore();
	const f = counter([{ items: [1, 2], at: new Date(0) }, { items: [1, 2], at: new Date(0) }]);
	await store.fetch('k', f.fetcher);
	const before = store.peek('k').data;
	await store.fetch('k', f.fetcher, { force: true });
	assert.equal(store.peek('k').data, before, 'same reference');
	assert.ok(store.peek('k').updatedAt > 0);
});

test('a refresh never removes data: while fetching, and after a failure', async () => {
	const store = new QueryStore();
	await store.fetch('k', async () => ({ v: 1 }));
	let release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	const pending = store.fetch('k', async () => {
		await gate;
		throw new Error('offline');
	}, { force: true });
	assert.deepEqual(store.peek('k').data, { v: 1 }, 'shown while the refresh runs');
	assert.equal(store.peek('k').isFetching, true);
	release();
	const held = await pending;
	assert.deepEqual(held, { v: 1 }, 'fetch resolves with the data still held — never rejects');
	assert.deepEqual(store.peek('k').data, { v: 1 });
	assert.equal((store.peek('k').error as Error).message, 'offline');
	assert.equal(store.peek('k').isFetching, false);
});

test('concurrent fetches for one key share one request', async () => {
	const store = new QueryStore();
	const f = counter([{ v: 1 }]);
	await Promise.all([store.fetch('k', f.fetcher), store.fetch('k', f.fetcher), store.fetch('k', f.fetcher)]);
	assert.equal(f.calls(), 1);
});

test('a slow older answer cannot land on top of a newer one', async () => {
	const store = new QueryStore();
	let releaseOld!: () => void;
	const oldGate = new Promise<void>((r) => (releaseOld = r));
	const old = store.fetch('k', async () => {
		await oldGate;
		return { v: 'old' };
	});
	await store.fetch('k', async () => ({ v: 'new' }), { force: true });
	releaseOld();
	await old;
	assert.deepEqual(store.peek('k').data, { v: 'new' });
});

test('invalidate keeps the data on screen, marks it stale and tells the screens', async () => {
	const store = new QueryStore({ staleMs: Infinity });
	await store.fetch('GET /billing/subscription::ws=w1', async () => ({ v: 1 }));
	await store.fetch('GET /workspaces::ws=w1', async () => ({ w: 1 }));
	let told = 0;
	store.subscribe('GET /billing/subscription::ws=w1', () => told++);
	store.invalidate('/billing');
	assert.equal(told, 1);
	assert.deepEqual(store.peek('GET /billing/subscription::ws=w1').data, { v: 1 });
	assert.equal(store.isStale('GET /billing/subscription::ws=w1'), true);
	assert.equal(store.isStale('GET /workspaces::ws=w1'), false, 'other resources untouched');
});

test('clear (sign-out) forgets everything, and a fetch started before it cannot write after it', async () => {
	const store = new QueryStore();
	let release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	const pending = store.fetch('k', async () => {
		await gate;
		return { secret: 'previous session' };
	});
	store.clear();
	release();
	await pending;
	assert.equal(store.peek('k').data, undefined);
});

test('deepEqual: JSON-shaped values and Dates', () => {
	assert.equal(deepEqual({ a: [1, { b: 'x' }] }, { a: [1, { b: 'x' }] }), true);
	assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
	assert.equal(deepEqual([1, 2], [2, 1]), false);
	assert.equal(deepEqual(new Date(5), new Date(5)), true);
	assert.equal(deepEqual(null, {}), false);
});

// ── through FonderieClient ──────────────────────────────────────────────────

function stubFetch(): { restore: () => void; calls: string[] } {
	const real = globalThis.fetch;
	const calls: string[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
		calls.push(`${init.method ?? 'GET'} ${url}`);
		return new Response(JSON.stringify({ reason: 'OK', explanation: '', result: {} }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	}) as typeof fetch;
	return { restore: () => (globalThis.fetch = real), calls };
}

test('client: the client and every sub-client read through the one store', () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test' });
	assert.equal(queryStoreFor(client), client.queries);
	assert.equal(queryStoreFor(client.billing), client.queries);
	assert.equal(queryStoreFor(client.workspaces), client.queries);
	assert.notEqual(queryStoreFor(new FonderieClient({ baseUrl: 'http://api.test' })), client.queries, 'one store per client');
});

test('client: a write marks the reads under its resource stale — with or without a response cache', async () => {
	const net = stubFetch();
	try {
		const client = new FonderieClient({ baseUrl: 'http://api.test', accessToken: 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111' });
		await client.queries.fetch('GET /billing/subscription::ws=', async () => ({ v: 1 }));
		assert.equal(client.queries.isStale('GET /billing/subscription::ws='), false);
		await client.request({ method: 'POST', path: '/billing/cancel' });
		assert.equal(client.queries.isStale('GET /billing/subscription::ws='), true);
	} finally {
		net.restore();
	}
});

test('client: signing out clears what the screens held', async () => {
	const client = new FonderieClient({ baseUrl: 'http://api.test', accessToken: 'aaaa-bbbb-cccc-dddd-eeee-ffff-0000-1111' });
	await client.queries.fetch('k', async () => ({ mine: true }));
	client.setAccessToken(undefined);
	assert.equal(client.queries.peek('k').data, undefined);
});
