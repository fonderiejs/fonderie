import { test } from 'node:test';
import assert from 'node:assert/strict';
import Koa from 'koa';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { mount } from '../index';

// Koa adds no X-Powered-By of its own, unlike Express — this locks that in, so
// a future Koa default (or something we add) can't start advertising the stack.

test('koa: no response header names the framework or fonderie', async () => {
	const fonderie = new FonderieApp(
		defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }),
	);
	fonderie.addRoute('GET', '/thing', async () => new Response('ok'));
	await fonderie.boot();

	const app = new Koa();
	mount(app, fonderie);
	const server = app.listen(0);
	await new Promise<void>((r) => server.once('listening', () => r()));
	const { port } = server.address() as { port: number };

	try {
		const res = await fetch(`http://127.0.0.1:${port}/thing`);
		assert.equal(res.headers.get('x-powered-by'), null);
		for (const [name, value] of res.headers) {
			assert.doesNotMatch(`${name}: ${value}`, /express|fonderie|koa|hono/i);
		}
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
});
