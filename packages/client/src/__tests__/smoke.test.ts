import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { FonderieApiError, FonderieClient, createMemoryCache } from '../index';

// ── fetch stub ───────────────────────────────────────────────────────────────
type Handler = (
	url: string,
	init: RequestInit,
) => { status: number; body: unknown; headers?: Record<string, string> };

const realFetch = globalThis.fetch;
let handler: Handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
const calls: Array<{
	method: string;
	path: string;
	auth?: string | undefined;
	workspace?: string | undefined;
	requestId?: string | undefined;
	traceparent?: string | undefined;
	body?: unknown;
}> = [];

globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
	const headers = (init.headers ?? {}) as Record<string, string>;
	calls.push({
		method: init.method ?? 'GET',
		path: url,
		auth: headers['Authorization'],
		workspace: headers['X-Workspace-ID'],
		requestId: headers['X-Request-ID'],
		traceparent: headers['traceparent'],
		body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
	});
	const { status, body, headers: resHeaders } = handler(url, init);
	return {
		status,
		ok: status >= 200 && status < 300,
		statusText: '',
		headers: new Headers(resHeaders ?? {}),
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
			return {
				status: 200,
				body: {
					reason: 'OK',
					explanation: '',
					result: { tokens: { access: 'new', refresh: 'r2' } },
				},
			};
		}
		// first /jobs call (token=old) → 401; retry (token=new) → 200
		const jobCall = calls.filter((x) => x.path.endsWith('/jobs')).length;
		if (jobCall === 1)
			return { status: 401, body: { reason: 'UNAUTHENTICATED', explanation: 'expired' } };
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

test('auth.appleNative posts the identityToken to /auth/apple/native and returns the session', async () => {
	handler = () => ({
		status: 200,
		body: {
			reason: 'APPLE_AUTH_SUCCESS',
			explanation: '',
			result: { tokens: { access: 'a', refresh: 'r' }, user: { id: 'u1' } },
		},
	});
	const c = new FonderieClient({ baseUrl: 'http://x' });
	const { result } = await c.auth.appleNative({ identityToken: 'id.tok.en', nonce: 'n1' });
	const call = calls.find((x) => x.path.endsWith('/auth/apple/native'));
	assert.equal(call?.method, 'POST');
	assert.deepEqual(call?.body, { identityToken: 'id.tok.en', nonce: 'n1' });
	assert.equal(result.tokens.access, 'a');
	assert.equal(result.user.id, 'u1');
});

// ── workspace scoping ────────────────────────────────────────────────────────
test('setWorkspaceId propagates to every workspace-scoped module, audit and webhooks included', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x' });
	c.setAccessToken('t');
	c.setWorkspaceId('ws-1');

	await c.audit.listEvents();
	await c.webhooks.listEndpoints();
	await c.customers.listCustomers();

	for (const call of calls) {
		assert.equal(call.workspace, 'ws-1', `${call.path} missing X-Workspace-ID`);
	}
});

test('constructor workspaceId scopes the modules without an explicit setWorkspaceId call', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x', workspaceId: 'ws-ctor' });
	c.setAccessToken('t');

	await c.audit.listEvents();
	await c.billing.getSubscription();

	for (const call of calls) {
		assert.equal(call.workspace, 'ws-ctor', `${call.path} missing X-Workspace-ID`);
	}
});

test('billing.getWallet + setWalletPreferences hit the wallet routes with workspace scope', async () => {
	handler = () => ({
		status: 200,
		body: {
			reason: 'OK',
			explanation: '',
			result: { wallet: { balance: '0', currency: 'USD', precision: 2, spendPurchased: false } },
		},
	});
	const c = new FonderieClient({ baseUrl: 'http://x', workspaceId: 'ws-1' });
	c.setAccessToken('t');

	const read = await c.billing.getWallet();
	assert.equal(read.result.wallet.spendPurchased, false);
	await c.billing.setWalletPreferences({ spendPurchased: false });

	const get = calls.find((x) => x.path.endsWith('/billing/wallet') && x.method === 'GET');
	const set = calls.find(
		(x) => x.path.endsWith('/billing/wallet/preferences') && x.method === 'POST',
	);
	assert.ok(get, 'GET /billing/wallet was called');
	assert.ok(set, 'POST /billing/wallet/preferences was called');
	assert.equal(set!.workspace, 'ws-1');
	assert.equal(set!.auth, 'Bearer t');
});

test('billing: cancel/reactivate, wallet checkout/transactions, payment-method, invoices hit their routes', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const c = new FonderieClient({ baseUrl: 'http://x', workspaceId: 'ws-1' });
	c.setAccessToken('t');

	await c.billing.cancelSubscription({ atPeriodEnd: false });
	await c.billing.reactivateSubscription();
	await c.billing.createWalletCheckout({ packId: 'small' });
	await c.billing.purchaseWalletPack({ packId: 'small', idempotencyKey: 'k1' });
	await c.billing.getWalletTransactions({ cursor: 'abc', limit: 25 });
	await c.billing.getPaymentMethod();
	await c.billing.listInvoices();
	await c.billing.setupPaymentMethod();
	await c.billing.savePaymentMethod({ paymentMethodId: 'pm_1' });
	await c.billing.removePaymentMethod();

	const hit = (method: string, endsWith: string) =>
		calls.find((x) => x.method === method && x.path.includes(endsWith));
	assert.ok(hit('POST', '/billing/subscription/cancel'), 'cancel');
	assert.ok(hit('POST', '/billing/subscription/reactivate'), 'reactivate');
	assert.ok(hit('POST', '/billing/wallet/checkout'), 'wallet checkout');
	assert.ok(hit('POST', '/billing/wallet/purchase'), 'wallet in-app purchase');
	const tx = hit('GET', '/billing/wallet/transactions');
	assert.ok(tx, 'wallet transactions');
	assert.ok(
		tx!.path.includes('cursor=abc') && tx!.path.includes('limit=25'),
		'transactions carry cursor + limit',
	);
	assert.ok(hit('GET', '/billing/payment-method'), 'payment method');
	assert.ok(hit('GET', '/billing/invoices'), 'invoices');
	assert.ok(hit('POST', '/billing/payment-method/setup'), 'setup payment method');
	const saved = hit('PUT', '/billing/payment-method');
	assert.ok(saved, 'save payment method (PUT)');
	assert.equal(
		(saved!.body as { paymentMethodId?: string })?.paymentMethodId,
		'pm_1',
		'save carries the pm id',
	);
	assert.ok(hit('DELETE', '/billing/payment-method'), 'remove payment method (DELETE)');
	// All authed + workspace-scoped like the rest of the billing surface.
	for (const call of calls) {
		assert.equal(call.auth, 'Bearer t', `${call.path} missing bearer`);
		assert.equal(call.workspace, 'ws-1', `${call.path} missing workspace`);
	}
});

// ── sign-out cache clearing ──────────────────────────────────────────────────
test('auth.setAccessToken(undefined) drops the shared response cache', async () => {
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: { jobs: [] } } });
	const c = new FonderieClient({ baseUrl: 'http://x', cache: createMemoryCache() });
	c.setAccessToken('t');

	await c.get('/jobs');
	await c.get('/jobs'); // cached
	assert.equal(calls.filter((x) => x.method === 'GET').length, 1);

	c.auth.setAccessToken(undefined); // the hooks' sign-out path
	await c.get('/jobs'); // must refetch — previous session's cache is gone
	assert.equal(calls.filter((x) => x.method === 'GET').length, 2);
});

// ── media ──────────────────────────────────────────────────────────────────
test('media: upload POSTs base64 to /media, delete DELETEs /media/:id, assetUrl is absolute', async () => {
	handler = () => ({
		status: 200,
		body: { reason: 'OK', explanation: '', result: { asset: { id: 'a1', url: '/media/a1' } } },
	});
	const c = new FonderieClient({ baseUrl: 'http://x' });
	c.setAccessToken('t');

	await c.media.upload({ dataBase64: 'AAAA', purpose: 'avatar' });
	await c.media.delete('a1');

	const up = calls.find((x) => x.method === 'POST' && x.path.endsWith('/media'));
	assert.ok(up, 'upload hits POST /media');
	assert.equal((up!.body as { dataBase64?: string; purpose?: string })?.dataBase64, 'AAAA');
	assert.equal((up!.body as { purpose?: string })?.purpose, 'avatar');
	assert.equal(up!.auth, 'Bearer t', 'upload is authed');

	const del = calls.find((x) => x.method === 'DELETE' && x.path.endsWith('/media/a1'));
	assert.ok(del, 'delete hits DELETE /media/:id');
	assert.equal(del!.auth, 'Bearer t', 'delete is authed');

	// assetUrl builds an absolute, tokenless <img src> against the client origin.
	assert.equal(c.media.assetUrl('a1'), 'http://x/media/a1');

	// assetIdFromUrl is the inverse — but only for our own UUID asset URLs.
	const uuid = '3ee8424d-d2d7-44a4-8fbd-3251e76971a2';
	assert.equal(c.media.assetIdFromUrl(`http://x/media/${uuid}`), uuid);
	assert.equal(c.media.assetIdFromUrl('/media/' + uuid), uuid);
	assert.equal(c.media.assetIdFromUrl('https://cdn.example.com/pic.png'), null);
	assert.equal(c.media.assetIdFromUrl(''), null);
});

// ── request correlation ──────────────────────────────────────────────────────
test('sends X-Request-ID on every call and surfaces it on FonderieApiError', async () => {
	const c = new FonderieClient({ baseUrl: 'http://x' });

	// Success: a 32-hex trace id is sent as X-Request-ID, and traceparent carries
	// the same trace id (W3C: 00-<trace>-<span>-01).
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	await c.get('/jobs');
	const call = calls.at(-1);
	const sent = call?.requestId;
	assert.match(sent ?? '', /^[0-9a-f]{32}$/, 'X-Request-ID is a 32-hex trace id');
	assert.equal(
		call?.traceparent,
		`00-${sent}-${call?.traceparent?.split('-')[2]}-01`,
		'traceparent well-formed',
	);
	assert.match(call?.traceparent ?? '', /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/, 'traceparent shape');
	assert.equal(call?.traceparent?.split('-')[1], sent, 'traceparent trace id == X-Request-ID');

	// Error: the server-echoed id is preferred on the thrown error.
	handler = () => ({
		status: 422,
		body: { reason: 'INVALID', explanation: 'nope' },
		headers: { 'X-Request-Id': 'srv-echo-123' },
	});
	await assert.rejects(
		() => c.get('/jobs'),
		(err: unknown) => {
			assert.ok(err instanceof FonderieApiError);
			assert.equal(err.requestId, 'srv-echo-123', 'prefers server echo');
			return true;
		},
	);

	// No echo → falls back to the id we generated and sent.
	handler = () => ({ status: 500, body: { reason: 'ERR', explanation: 'boom' } });
	await assert.rejects(
		() => c.get('/jobs'),
		(err: unknown) => {
			assert.ok(err instanceof FonderieApiError);
			assert.equal(err.requestId, calls.at(-1)?.requestId, 'falls back to the sent id');
			return true;
		},
	);
});

// ── AdminClient: the operator's surface, one token, prefix-aware ────────────
test('AdminClient: every page under the prefix with the admin token; log query forwarded; prefix movable', async () => {
	const { AdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: { ok: true } } });

	const admin = new AdminClient({
		baseUrl: 'http://x',
		adminToken: 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb',
	});
	await admin.attention();
	await admin.manifest();
	await admin.doctor();
	await admin.config();
	await admin.routes();
	await admin.tokens();
	await admin.adminLog({ limit: 5, before: 'c1' });
	assert.deepEqual(
		calls.map((c) => c.path.replace('http://x', '')),
		[
			'/_admin',
			'/_admin/manifest',
			'/_admin/doctor',
			'/_admin/config',
			'/_admin/routes',
			'/_admin/access/tokens',
			'/_admin/activity/admin-log?limit=5&before=c1',
		],
	);
	assert.ok(
		calls.every(
			(c) => c.method === 'GET' && c.auth === 'Bearer aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb',
		),
	);

	calls.length = 0;
	const moved = new AdminClient({
		baseUrl: 'http://x',
		adminToken: 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb',
		prefix: '/ops/',
	});
	await moved.doctor();
	assert.equal(calls[0]?.path, 'http://x/ops/doctor');
});

test('ConfigAdminClient / CourierAdminClient: prefix rebases the legacy /admin segment for the composed surface', async () => {
	const { ConfigAdminClient, CourierAdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: [] } });
	const tok = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';

	await new ConfigAdminClient({ baseUrl: 'http://x', adminToken: tok }).listConfig('prod');
	await new ConfigAdminClient({
		baseUrl: 'http://x',
		adminToken: tok,
		prefix: '/_admin/',
	}).listConfig('prod');
	await new ConfigAdminClient({
		baseUrl: 'http://x',
		adminToken: tok,
		prefix: '/_admin',
	}).revealSecret('k');
	await new CourierAdminClient({
		baseUrl: 'http://x',
		adminToken: tok,
		prefix: '/_admin',
	}).listTemplates();
	assert.deepEqual(
		calls.map((c) => c.path.replace('http://x', '')),
		[
			'/admin/config?environment=prod',
			'/_admin/config?environment=prod',
			'/_admin/secrets/k/reveal',
			'/_admin/templates',
		],
	);
});

test('AuthAdminClient: user routes under the prefix; history query forwarded; ids encoded', async () => {
	const { AuthAdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const tok = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';
	const a = new AuthAdminClient({ baseUrl: 'http://x', adminToken: tok, actor: 'ada' });
	await a.findUser('Ada@Example.com');
	await a.getUser('u/1');
	await a.listUserSessions('u1');
	await a.revokeUserSessions('u1');
	await a.userLoginHistory('u1', { limit: 3, cursor: 'c' });
	await a.suspendUser('u1');
	await a.unsuspendUser('u1');
	assert.deepEqual(
		calls.map((c) => `${c.method} ${c.path.replace('http://x', '')}`),
		[
			'GET /_admin/users?email=Ada%40Example.com',
			'GET /_admin/users/u%2F1',
			'GET /_admin/users/u1/sessions',
			'DELETE /_admin/users/u1/sessions',
			'GET /_admin/users/u1/login-history?limit=3&cursor=c',
			'POST /_admin/users/u1/suspend',
			'POST /_admin/users/u1/unsuspend',
		],
	);
	assert.ok(calls.every((c) => c.auth === `Bearer ${tok}`));
	calls.length = 0;
	await new AuthAdminClient({ baseUrl: 'http://x', adminToken: tok, prefix: '/ops' }).getUser('u1');
	assert.equal(calls[0]?.path, 'http://x/ops/users/u1');
});

test('BillingAdminClient: catalog, plan writes, subscription, wallet, ledger, grant — under the prefix', async () => {
	const { BillingAdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({ status: 200, body: { reason: 'OK', explanation: '', result: {} } });
	const tok = 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb';
	const b = new BillingAdminClient({ baseUrl: 'http://x', adminToken: tok });
	await b.catalog();
	await b.createPlan({ name: 'pro', monthlyAmount: 1900 });
	await b.updatePlan('p/1', { seats: 5 });
	await b.deletePlan('p1');
	await b.subscription('workspace', 'w1');
	await b.wallet('user', 'u1', 'eur');
	await b.walletLedger('user', 'u1', { currency: 'EUR', limit: 5, cursor: 'c' });
	await b.grant({
		subscriberType: 'user',
		subscriberId: 'u1',
		amount: '500',
		idempotencyKey: 'k1',
	});
	assert.deepEqual(
		calls.map((c) => `${c.method} ${c.path.replace('http://x', '')}`),
		[
			'GET /_admin/catalog',
			'POST /_admin/plans',
			'PUT /_admin/plans/p%2F1',
			'DELETE /_admin/plans/p1',
			'GET /_admin/subscriptions/workspace/w1',
			'GET /_admin/wallet/user/u1?currency=eur',
			'GET /_admin/wallet/user/u1/ledger?currency=EUR&limit=5&cursor=c',
			'POST /_admin/wallet/grant',
		],
	);
	assert.deepEqual(calls[1]?.body, { name: 'pro', monthlyAmount: 1900 });
	assert.deepEqual(calls[7]?.body, {
		subscriberType: 'user',
		subscriberId: 'u1',
		amount: '500',
		idempotencyKey: 'k1',
	});
	assert.ok(calls.every((c) => c.auth === `Bearer ${tok}`));
});

test('AuditAdminClient: filters and dates forwarded under the prefix', async () => {
	const { AuditAdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({
		status: 200,
		body: { reason: 'OK', explanation: '', result: { events: [], nextCursor: null } },
	});
	const a = new AuditAdminClient({
		baseUrl: 'http://x',
		adminToken: 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb',
	});
	await a.listAudit();
	await a.listAudit({
		workspaceId: 'w1',
		type: 'user.login',
		actorId: 'u1',
		from: new Date('2026-01-01T00:00:00Z'),
		limit: 5,
		cursor: 'c',
	});
	assert.deepEqual(
		calls.map((c) => c.path.replace('http://x', '')),
		[
			'/_admin/audit',
			'/_admin/audit?workspaceId=w1&type=user.login&actorId=u1&from=2026-01-01T00%3A00%3A00.000Z&limit=5&cursor=c',
		],
	);
});

test('AdminClient: issueToken / revokeToken under the prefix', async () => {
	const { AdminClient } = await import('../index');
	calls.length = 0;
	handler = () => ({
		status: 201,
		body: { reason: 'OK', explanation: '', result: { token: 'fad_x' } },
	});
	const a = new AdminClient({
		baseUrl: 'http://x',
		adminToken: 'aaaa-bbbb-aaaa-bbbb-aaaa-bbbb-aaaa-bbbb',
	});
	await a.issueToken({ name: 'dashboard', scopes: ['read'], expiresInDays: 30 });
	await a.revokeToken('t/1');
	assert.deepEqual(
		calls.map((c) => `${c.method} ${c.path.replace('http://x', '')}`),
		['POST /_admin/access/tokens', 'DELETE /_admin/access/tokens/t%2F1'],
	);
	assert.deepEqual(calls[0]?.body, { name: 'dashboard', scopes: ['read'], expiresInDays: 30 });
});

test('restore real fetch', () => {
	globalThis.fetch = realFetch;
});

test('isMfaRequired discriminates MFA-required from full login results', async () => {
	const { isMfaRequired } = await import('../types');
	assert.equal(isMfaRequired({ mfaToken: 'tmp' }), true);
	assert.equal(
		isMfaRequired({
			tokens: { access: 'a', refresh: 'r' },
			user: {} as never,
		}),
		false,
	);
});
