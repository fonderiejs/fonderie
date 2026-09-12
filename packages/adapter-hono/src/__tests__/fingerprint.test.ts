import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { bridge, mount } from '../index';

// Hono adds no X-Powered-By of its own, unlike Express — this locks that in, so
// a future Hono default (or something we add) can't start advertising the stack.

test('hono: no response header names the framework or fonderie', async () => {
	const fonderie = new FonderieApp(
		defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }),
	);
	fonderie.addRoute('GET', '/thing', async () => new Response('ok'));
	await fonderie.boot();

	const hono = new Hono();
	hono.use('*', bridge(fonderie));
	mount(hono, fonderie);

	const res = await hono.request('http://localhost/thing');
	assert.equal(res.headers.get('x-powered-by'), null);
	for (const [name, value] of res.headers) {
		assert.doesNotMatch(`${name}: ${value}`, /express|fonderie|koa|hono/i);
	}
});
