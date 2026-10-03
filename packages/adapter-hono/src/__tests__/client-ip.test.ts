import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import { FonderieApp, defineConfig } from '@fonderie/core';

// Set before importing the adapter: resolveClientIp reads TRUST_PROXY to decide
// whether X-Forwarded-For may be believed, and Hono has no socket to fall back on.
process.env['TRUST_PROXY'] = '1';

import { bridge, mount } from '../index';

// Guards the bug where the adapter resolved the client IP into its own context
// and handle() then built a FRESH one, dropping it — so every fonderie-owned
// route saw `undefined`. Hono has no socket, so the IP comes from the
// forwarding header; what matters is that it SURVIVES into the routed handler.

test('hono: the client IP reaches a fonderie-routed handler', async () => {
	const fonderie = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	fonderie.addRoute('GET', '/whoami', async (ctx) =>
		Response.json({ ip: ctx.meta.clientIp ?? null }),
	);
	await fonderie.boot();

	const hono = new Hono();
	hono.use('*', bridge(fonderie));
	mount(hono, fonderie);

	const res = await hono.request('http://localhost/whoami', {
		headers: { 'x-forwarded-for': '198.51.100.42' },
	});
	const body = (await res.json()) as { ip: string | null };
	assert.equal(body.ip, '198.51.100.42', 'a fonderie route must see the client IP');
});

// The global stack runs in bridge() AND again inside handle() for a fonderie
// route. mount() must hand handle() the first pass's meta as `bridged`, or a
// per-request side effect — billing's request counter — happens twice.
test('hono: a fonderie-routed request carries the bridge pass meta (side effects run once)', async () => {
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

	const hono = new Hono();
	hono.use('*', bridge(fonderie));
	mount(hono, fonderie);

	const res = await hono.request('http://localhost/once');
	{
		const body = (await res.json()) as { bridgedStamp: string | null };
		assert.equal(body.bridgedStamp, 'first-pass', 'the route sees the bridge pass meta');
		assert.equal(sideEffects, 1, 'one request, one side effect — not one per pass');
	}
});
