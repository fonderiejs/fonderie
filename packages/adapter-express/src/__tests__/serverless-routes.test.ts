import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { mount } from '../index';

// Serverless entries default-export the app; nothing calls listen(). mount()
// used to register fonderie's catch-all only from listen(), so on Vercel every
// fonderie route 404'd while the app's own routes worked. Drive the app the way
// a serverless runtime does — straight into http.createServer, no listen() on
// the express app — and assert fonderie's routes are served.

async function viaServerlessStyle(build: (app: express.Express) => void) {
	const fonderie = new FonderieApp(
		defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }),
	);
	fonderie.addRoute('GET', '/fonderie-route', async () => Response.json({ served: 'fonderie' }));
	await fonderie.boot();

	const app = express();
	mount(app, fonderie);
	build(app);

	const server = http.createServer(app);
	server.listen(0);
	await new Promise<void>((r) => server.once('listening', () => r()));
	const { port } = server.address() as { port: number };
	try {
		return {
			fonderieRoute: await fetch(`http://127.0.0.1:${port}/fonderie-route`),
			appRoute: await fetch(`http://127.0.0.1:${port}/app-route`),
		};
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
}

test('express: fonderie routes are served without listen() (serverless)', async () => {
	const { fonderieRoute } = await viaServerlessStyle((app) => {
		app.get('/app-route', (_q, s) => s.json({ served: 'app' }));
	});
	assert.equal(fonderieRoute.status, 200);
	assert.deepEqual(await fonderieRoute.json(), { served: 'fonderie' });
});

test('express: a route added after mount() still wins over the catch-all', async () => {
	const { appRoute } = await viaServerlessStyle((app) => {
		app.get('/app-route', (_q, s) => s.json({ served: 'app' }));
	});
	assert.deepEqual(await appRoute.json(), { served: 'app' });
});
