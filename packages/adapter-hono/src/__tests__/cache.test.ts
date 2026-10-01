import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Hono } from 'hono';

import { withCache } from '../index';

test('withCache (hono): sets Cache-Control from the policy; private by default', async () => {
	const app = new Hono();
	app.get('/catalog', withCache({ maxAge: 300 }), (c) => c.json({ ok: true }));
	app.get('/shared', withCache({ maxAge: 60, scope: 'public' }), (c) => c.json({ ok: true }));
	app.get('/live', withCache(false), (c) => c.json({ ok: true }));
	assert.equal((await app.request('http://localhost/catalog')).headers.get('cache-control'), 'private, max-age=300');
	assert.equal((await app.request('http://localhost/shared')).headers.get('cache-control'), 'public, max-age=60');
	assert.equal((await app.request('http://localhost/live')).headers.get('cache-control'), 'no-store');
});

test('withCache (hono): a Cache-Control the handler set itself is kept; the body is intact', async () => {
	const app = new Hono();
	app.get('/own', withCache({ maxAge: 300 }), (c) => {
		c.header('Cache-Control', 'no-store');
		return c.json({ value: 42 });
	});
	const res = await app.request('http://localhost/own');
	assert.equal(res.headers.get('cache-control'), 'no-store');
	assert.deepEqual(await res.json(), { value: 42 });
});
