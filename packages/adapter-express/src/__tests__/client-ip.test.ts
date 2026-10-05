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

// The global stack runs in bridge() AND again inside handle() for a fonderie
// route. mount() must hand handle() the first pass's meta as `bridged`, or a
// per-request side effect — billing's request counter — happens twice.
test('express: a fonderie-routed request carries the bridge pass meta (side effects run once)', async () => {
	const fonderie = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	// A global middleware with a per-request side effect (like billing's request
	// counter), written the documented way: skip when the bridge pass already did it.
	let sideEffects = 0;
	fonderie.use(async (ctx, next) => {
		if (!ctx.meta.bridged) {
			sideEffects++;
			ctx.meta['stamp'] = 'first-pass';
		}
		return next();
	});
	fonderie.addRoute('GET', '/once', async (ctx) =>
		Response.json({ bridgedStamp: ctx.meta.bridged?.['stamp'] ?? null }),
	);
	await fonderie.boot();

	const app = mount(express(), fonderie);
	const server = app.listen(0);
	await new Promise<void>((r) => server.once('listening', () => r()));
	const { port } = server.address() as { port: number };

	try {
		const res = await fetch(`http://127.0.0.1:${port}/once`);
		const body = (await res.json()) as { bridgedStamp: string | null };
		assert.equal(body.bridgedStamp, 'first-pass', 'the route sees the bridge pass meta');
		assert.equal(sideEffects, 1, 'one request, one side effect — not one per pass');
	} finally {
		await new Promise<void>((r) => server.close(() => r()));
	}
});
