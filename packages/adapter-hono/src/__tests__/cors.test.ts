import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { cors } from '../index';

function appWithCors(options?: Parameters<typeof cors>[0]) {
	const app = new Hono();
	app.use('*', cors(options));
	app.get('/thing', (c) => c.text('ok'));
	return app;
}

test('cors (hono): preflight gets 204 with the client header contract; the route never runs', async () => {
	const res = await appWithCors().request('http://localhost/thing', {
		method: 'OPTIONS',
		headers: { origin: 'http://localhost:5173' },
	});
	assert.equal(res.status, 204);
	const allow = res.headers.get('Access-Control-Allow-Headers') ?? '';
	for (const h of ['X-Request-ID', 'traceparent', 'X-Workspace-ID', 'Content-Type', 'Authorization']) {
		assert.ok(allow.includes(h), `${h} must be allowed by default`);
	}
	assert.equal(res.headers.get('Access-Control-Expose-Headers'), 'X-Request-ID');
});

test('cors (hono): non-preflight responses carry the headers, body intact', async () => {
	const res = await appWithCors().request('http://localhost/thing', {
		headers: { origin: 'http://localhost:5173' },
	});
	assert.equal(await res.text(), 'ok');
	assert.ok((res.headers.get('Access-Control-Allow-Headers') ?? '').includes('X-Request-ID'));
});

test('cors (hono): credentialed setup needs an explicit origin, then emits the pair', async () => {
	assert.throws(() => cors({ credentials: true }), /origin/);
	const res = await appWithCors({ credentials: true, origin: 'http://localhost:5173' }).request(
		'http://localhost/thing',
		{ headers: { origin: 'http://localhost:5173' } },
	);
	assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
	assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
});
