import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import { bridge, adapt, mount, requireAuth } from '../index';
import type { FonderieApp, IFonderieContext } from '@fonderie/core';

// ── Stubs ─────────────────────────────────────────────────────────

function makeCtx(user: unknown = null, meta: Record<string, unknown> = {}): IFonderieContext {
	return {
		user,
		workspace: null,
		tenant: null,
		meta,
		request: new Request('http://localhost/'),
	} as unknown as IFonderieContext;
}

function makeApp(user: unknown = null, meta: Record<string, unknown> = {}): FonderieApp {
	return {
		buildContext: async (req: Request) => ({ ...makeCtx(user, meta), request: req }),
		handle: async (_req: Request) => Response.json({ from: 'fonderie' }),
	} as unknown as FonderieApp;
}

// ── bridge ────────────────────────────────────────────────────────

test('bridge: populates _fonderie on Hono context', async () => {
	const app = new Hono();
	app.use('*', bridge(makeApp({ id: 'u1' })));
	app.get('/me', (c) => {
		const ctx = c.get('_fonderie');
		return c.json({ userId: (ctx.user as any).id });
	});

	const res = await app.request('/me');
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.equal(body.userId, 'u1');
});

test('bridge: clones request so body is available downstream', async () => {
	const app = new Hono();
	app.use('*', bridge(makeApp()));
	app.post('/echo', async (c) => {
		const body = await c.req.json();
		return c.json(body);
	});

	const res = await app.request('/echo', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ hello: 'world' }),
	});
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.equal(body.hello, 'world');
});

// ── adapt ─────────────────────────────────────────────────────────

test('adapt: calls next when fonderie middleware continues', async () => {
	const app = new Hono();
	const passOn = adapt(async (_ctx, next) => next());

	app.use('*', bridge(makeApp()));
	app.get('/test', passOn, (c) => c.json({ ok: true }));

	const res = await app.request('/test');
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.ok(body.ok);
});

test('adapt: short-circuits with response when fonderie middleware guards', async () => {
	const app = new Hono();
	const guard = adapt(async () => Response.json({ blocked: true }, { status: 403 }));

	app.use('*', bridge(makeApp()));
	app.get('/test', guard, (c) => c.json({ reached: true }));

	const res = await app.request('/test');
	const body = (await res.json()) as any;

	assert.equal(res.status, 403);
	assert.ok(body.blocked);
	assert.equal(body.reached, undefined);
});

test('adapt: throws when bridge has not run', async () => {
	const app = new Hono();
	const guard = adapt(async (_ctx, next) => next());
	// No bridge registered
	app.get('/test', guard, (c) => c.json({ ok: true }));

	const res = await app.request('/test');

	// Hono's default error handler returns 500 on unhandled throws
	assert.equal(res.status, 500);
});

// ── requireAuth ───────────────────────────────────────────────────

test('requireAuth: 401 when ctx.user is null', async () => {
	const app = new Hono();
	app.use('*', bridge(makeApp(null)));
	app.get('/protected', requireAuth, (c) => c.json({ ok: true }));

	const res = await app.request('/protected');

	assert.equal(res.status, 401);
});

test('requireAuth: calls next when user is set', async () => {
	const app = new Hono();
	app.use('*', bridge(makeApp({ id: 'u1' })));
	app.get('/protected', requireAuth, (c) => c.json({ ok: true }));

	const res = await app.request('/protected');
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.ok(body.ok);
});

// ── mount ─────────────────────────────────────────────────────────

test('mount: returns the same Hono instance', () => {
	const hono = new Hono();
	const result = mount(hono, makeApp());
	assert.strictEqual(result, hono);
});

test('mount: ctx._fonderie is available in user routes', async () => {
	const fonderie = makeApp({ id: 'u1' });
	const app = new Hono();
	app.use('*', bridge(fonderie));
	mount(app, fonderie);
	app.get('/me', (c) => {
		const ctx = c.get('_fonderie');
		return c.json({ userId: (ctx.user as any).id });
	});

	const res = await app.request('/me');
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.equal(body.userId, 'u1');
});

test('mount: user routes added after mount take priority', async () => {
	const app = mount(new Hono(), makeApp());
	app.get('/v1/health', (c) => c.json({ mine: true }));

	const res = await app.request('/v1/health');
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.ok(body.mine);
});

test('mount: unmatched routes are delegated to fonderie.handle()', async () => {
	const app = mount(new Hono(), makeApp());

	const res = await app.request('/v1/auth/login', { method: 'POST' });
	const body = (await res.json()) as any;

	assert.equal(res.status, 200);
	assert.equal(body.from, 'fonderie');
});

// ── Regression: large bodies must flow through bridge+mount without a
// tee-stall (audit №2 follow-up). bridge() used to clone() the raw request;
// undici's tee stalls once ONE branch reads past the high-water mark while
// the other sits unread — so any body over ~a few KiB hung the request.

test('bridge + mount: a multi-MiB in-cap body completes and reaches fonderie', async () => {
	const { FonderieApp, defineConfig } = await import('@fonderie/core');
	const fonderie = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	fonderie.addRoute('POST', '/echo', async (ctx) =>
		Response.json({ len: ((ctx.meta['body'] as { pad?: string })?.pad ?? '').length }),
	);
	await fonderie.boot();

	const app = new Hono();
	app.use('*', bridge(fonderie));
	mount(app, fonderie);

	const pad = 'x'.repeat(4 * 1024 * 1024); // 4 MiB — inside the 5 MiB cap
	const res = await app.request('/echo', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ pad }),
	});
	assert.equal(res.status, 200);
	assert.equal(((await res.json()) as any).len, pad.length);
});

test('bridge + mount: an oversize body is rejected 413 by the parser', async () => {
	const { FonderieApp, defineConfig } = await import('@fonderie/core');
	const fonderie = new FonderieApp(
		defineConfig({ db: { url: 'postgres://localhost/test' }, maxBodyBytes: 1024 }),
	);
	fonderie.addRoute('POST', '/echo', async () => Response.json({ ok: true }));
	await fonderie.boot();

	const app = new Hono();
	app.use('*', bridge(fonderie));
	mount(app, fonderie);

	const res = await app.request('/echo', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ pad: 'x'.repeat(8192) }),
	});
	assert.equal(res.status, 413);
});
