import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FonderieClient, createMemoryCache } from '../index';

// ── fetch stub ───────────────────────────────────────────────────────────────
type Handler = (url: string, init: RequestInit) => { status: number; body: unknown };

const realFetch = globalThis.fetch;
let handler: Handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
const calls: Array<{ method: string; path: string; auth?: string | undefined }> = [];

globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
	const headers = (init.headers ?? {}) as Record<string, string>;
	calls.push({ method: init.method ?? 'GET', path: url, auth: headers['Authorization'] });
	const { status, body } = handler(url, init);
	return {
		status,
		ok: status >= 200 && status < 300,
		statusText: '',
		json: async () => body,
	} as Response;
}) as typeof fetch;

afterEach(() => {
	calls.length = 0;
});

// ── cache ────────────────────────────────────────────────────────────────────
test('caches GETs and dedupes; writes invalidate the resource', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: { jobs: [] } } });
	const c = new FonderieClient({ baseUrl: 'http://x', cache: createMemoryCache() });

	await c.get('/jobs');
	await c.get('/jobs'); // served from cache — no second fetch
	assert.equal(calls.filter((x) => x.path.endsWith('/jobs') && x.method === 'GET').length, 1);

	await c.post('/jobs', { title: 'a' }); // invalidates /jobs
	await c.get('/jobs'); // must hit the network again
	assert.equal(calls.filter((x) => x.path.endsWith('/jobs') && x.method === 'GET').length, 2);
});

test('no cache configured → every GET hits the network', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x' });
	await c.get('/jobs');
	await c.get('/jobs');
	assert.equal(calls.filter((x) => x.method === 'GET').length, 2);
});

// ── reactive renew ───────────────────────────────────────────────────────────
test('refreshes once on 401 and retries with the new token', async () => {
	let changed: unknown = null;
	const c = new FonderieClient({
		baseUrl: 'http://x',
		accessToken: 'old',
		auth: {
			getRefreshToken: () => 'refresh-tok',
			onTokensChanged: (t) => {
				changed = t;
			},
		},
	});

	handler = (url) => {
		if (url.endsWith('/auth/refresh')) {
			return { status: 200, body: { reason: 'OK', explanation: '', result: { tokens: { access: 'new', refresh: 'r2' } } } };
		}
		// first /jobs call (token=old) → 401; retry (token=new) → 200
		const jobCall = calls.filter((x) => x.path.endsWith('/jobs')).length;
		if (jobCall === 1) return { status: 401, body: { reason: 'UNAUTHENTICATED', explanation: 'expired' } };
		return { status: 200, body: { reason: 'OK', explanation: '', result: { jobs: [] } } };
	};

	const res = await c.get('/jobs');
	assert.deepEqual((res.result as { jobs: unknown[] }).jobs, []);
	assert.deepEqual(changed, { access: 'new', refresh: 'r2' });

	const jobCalls = calls.filter((x) => x.path.endsWith('/jobs'));
	assert.equal(jobCalls.length, 2);
	assert.equal(jobCalls[0]!.auth, 'Bearer old');
	assert.equal(jobCalls[1]!.auth, 'Bearer new'); // retried with refreshed token
});

test('per-call token overrides the stored Bearer (e.g. MFA login)', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x' });
	c.setAccessToken('stored-token');
	await c.post('/auth/mfa/verify', { token: '123' }, { token: 'mfa-temp-token' });
	const call = calls.find((x) => x.path.endsWith('/auth/mfa/verify'));
	assert.equal(call?.auth, 'Bearer mfa-temp-token'); // override wins
});

test('without a per-call token, uses the stored Bearer', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x' });
	c.setAccessToken('stored-token');
	await c.get('/users');
	const call = calls.find((x) => x.path.endsWith('/users'));
	assert.equal(call?.auth, 'Bearer stored-token');
});

test('auth.mfa.verifyLogin sends the mfaToken as bearer', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x' });
	c.setAccessToken('session-token');
	await c.auth.mfa.verifyLogin('mfa-temp', '123456');
	const call = calls.find((x) => x.path.endsWith('/auth/mfa/verify'));
	assert.equal(call?.auth, 'Bearer mfa-temp');
});

test('restore real fetch', () => {
	globalThis.fetch = realFetch;
});
