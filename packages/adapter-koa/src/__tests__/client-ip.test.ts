import { test } from 'node:test';
import assert from 'node:assert/strict';
import Koa from 'koa';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { mount } from '../index';

// Guards the bug where the adapter resolved the client IP into its own context
// and handle() then built a FRESH one, dropping it — so every fonderie-owned
// route saw `undefined`. Drives a real socket end to end.

test('koa: the client IP reaches a fonderie-routed handler', async () => {
	const fonderie = new FonderieApp(defineConfig({ basePath: '' }));
	fonderie.addRoute('GET', '/whoami', async (ctx) =>
		Response.json({ ip: ctx.meta.clientIp ?? null }),
	);
	await fonderie.boot();

	const app = new Koa();
	mount(app, fonderie);

	const server = app.listen(0);
	await new Promise<void>((r) => server.once('listening', () => r()));
	const { port } = server.address() as { port: number };

	try {
		const res = await fetch(`http://127.0.0.1:${port}/whoami`);
		const body = (await res.json()) as { ip: string | null };
		assert.ok(body.ip, 'a fonderie route must see the client IP, not undefined');
		assert.match(body.ip!, /^(127\.0\.0\.1|::1)$/);
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
});
