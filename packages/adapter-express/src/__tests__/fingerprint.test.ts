import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { mount } from '../index';

// Mass scanners build target lists from stack fingerprints, so a fonderie app
// must not announce its framework. Express is the only one of the three that
// sends such a header by default; mount() turns it off so no app author has to.

async function servedBy(makeApp: () => express.Express) {
	const fonderie = new FonderieApp(
		defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }),
	);
	fonderie.addRoute('GET', '/thing', async () => new Response('ok'));
	await fonderie.boot();

	const app = mount(makeApp(), fonderie);
	const server = app.listen(0);
	await new Promise<void>((r) => server.once('listening', () => r()));
	const { port } = server.address() as { port: number };
	try {
		return await fetch(`http://127.0.0.1:${port}/thing`);
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
}

test('express: mount() suppresses the X-Powered-By fingerprint', async () => {
	const res = await servedBy(() => express());
	assert.equal(res.headers.get('x-powered-by'), null);
});

test('express: no response header names the framework or fonderie', async () => {
	const res = await servedBy(() => express());
	for (const [name, value] of res.headers) {
		assert.doesNotMatch(
			`${name}: ${value}`,
			/express|fonderie|koa|hono/i,
			`response header "${name}" leaks the stack`,
		);
	}
});
