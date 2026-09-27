import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FonderieClient } from '../index';

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

function respond(values: Record<string, unknown>, status = 200) {
	let calls = 0;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		calls++;
		assert.match(String(input), /\/config\/public$/);
		return new Response(JSON.stringify({ reason: 'PUBLIC_CONFIG_FETCHED', explanation: '', result: { values } }), {
			status,
			headers: { 'content-type': 'application/json' },
		});
	}) as typeof fetch;
	return () => calls;
}

test('config.load fills one shared snapshot; get() reads it with a safe fallback', async () => {
	respond({ ENABLE_JOB_LISTING: true, MAX_ACTIVE_JOBS: 3 });
	const client = new FonderieClient({ baseUrl: 'https://api.example.com' });
	assert.equal(client.config.get('ENABLE_JOB_LISTING', false), false, 'fallback before any load');
	await client.config.load();
	assert.equal(client.config.get('ENABLE_JOB_LISTING', false), true);
	assert.equal(client.config.get('MAX_ACTIVE_JOBS', 0), 3);
	assert.equal(client.config.get('NOT_EXPOSED', 'off'), 'off');
	assert.ok(client.config.snapshot().loadedAt instanceof Date);
});

test('concurrent loads share one request; subscribers see every change', async () => {
	const calls = respond({ A: 1 });
	const client = new FonderieClient({ baseUrl: 'https://api.example.com' });
	const seen: boolean[] = [];
	const off = client.config.subscribe((s) => seen.push(s.isLoading));
	await Promise.all([client.config.load(), client.config.load(), client.config.load()]);
	off();
	assert.equal(calls(), 1, 'one request for three callers');
	assert.deepEqual(seen, [true, false], 'loading, then loaded');
});

test('a failed refresh keeps the previous values and reports the error', async () => {
	respond({ ENABLE_JOB_LISTING: true });
	const client = new FonderieClient({ baseUrl: 'https://api.example.com' });
	await client.config.load();
	respond({}, 500);
	await client.config.load();
	assert.equal(client.config.get('ENABLE_JOB_LISTING', false), true, 'a flag that was on does not flicker off');
	assert.ok(client.config.snapshot().error, 'the failure is visible');
});

test('prototype names never read as set', async () => {
	respond({});
	const client = new FonderieClient({ baseUrl: 'https://api.example.com' });
	await client.config.load();
	assert.equal(client.config.get('constructor', 'safe'), 'safe');
});
