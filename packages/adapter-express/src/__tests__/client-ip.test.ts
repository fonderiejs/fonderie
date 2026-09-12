import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { FonderieApp, defineConfig } from '@fonderie/core';

import { mount } from '../index';

// The bug this guards: the adapter resolved the client IP into its own context,
// then handle() built a FRESH one and dropped it — so every fonderie-owned
// route saw `undefined`. Asserting that bridge() sets meta.clientIp was not
// enough; it has to survive INTO a routed handler. This drives a real socket
// so the whole path (socket → bridge → handle → route) is exercised.

test('express: the client IP reaches a fonderie-routed handler', async () => {
	const fonderie = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	fonderie.addRoute('GET', '/whoami', async (ctx) =>
		Response.json({ ip: ctx.meta.clientIp ?? null }),
	);
	await fonderie.boot();

	const app = mount(express(), fonderie);
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
