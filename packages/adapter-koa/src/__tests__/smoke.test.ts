import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	bridge,
	adapt,
	mount,
	requireAuth,
	koaContextToWeb,
	webResponseToKoa,
	type KoaContext,
	type KoaNext,
} from '../index';
import type { FonderieApp, IFonderieContext } from '@fonderie-js/core';

// ── Stubs ─────────────────────────────────────────────────────────

function makeCtx(user: unknown = null, meta: Record<string, unknown> = {}): IFonderieContext {
	return {
		user,
		workspace: null,
		tenant: null,
		meta,
		request: new Request('http://localhost/'),
		_router: null as any,
	} as unknown as IFonderieContext;
}

function makeApp(user: unknown = null, meta: Record<string, unknown> = {}): FonderieApp {
	return {
		buildContext: async (req: Request) => ({ ...makeCtx(user, meta), request: req }),
		handle: async (_req: Request) => Response.json({ from: 'fonderie' }),
	} as unknown as FonderieApp;
}

function makeKoaCtx(
	opts: { method?: string; url?: string; headers?: Record<string, string>; rawBody?: string } = {},
) {
	const response = {
		body: undefined as unknown,
		status: 200,
		headers: {} as Record<string, string>,
		set(k: string, v: string) {
			this.headers[k] = v;
		},
	};
	// Mirror Koa's ctx.body ↔ ctx.response.body delegation so the
	// mount() fallback check (ctx.body === undefined) behaves correctly.
	const ctx = {
		request: {
			method: opts.method ?? 'GET',
			url: opts.url ?? '/',
			headers: { host: 'localhost', ...opts.headers },
			rawBody: opts.rawBody,
		},
		response,
		req: { socket: {} } as any,
		state: {} as Record<string, unknown>,
		get body() { return response.body; },
		set body(v: unknown) { response.body = v; },
	};
	return ctx;
}

// mount() registers a single wrap-around middleware via app.use().
// Collect it via a minimal stub to test its behaviour without going
// through a real Koa instance (avoids a CJS/ESM interop issue with
// is-generator-function under tsx).
function collectMiddleware(fonderie: FonderieApp) {
	type Mw = (ctx: unknown, next: () => Promise<void>) => Promise<void>;
	const registered: Mw[] = [];
	const stub = { use: (fn: Mw) => { registered.push(fn); return stub; } };
	mount(stub as any, fonderie);
	return registered[0]!;
}

// ── koaContextToWeb ───────────────────────────────────────────────

test('koaContextToWeb: preserves method and URL', () => {
	const ctx = makeKoaCtx({ method: 'PUT', url: '/v1/users/5' });
	const webReq = koaContextToWeb(ctx as unknown as KoaContext);

	assert.equal(webReq.method, 'PUT');
	assert.ok(webReq.url.endsWith('/v1/users/5'));
});

test('koaContextToWeb: copies request headers', () => {
	const ctx = makeKoaCtx({ headers: { 'x-tenant': 'acme', authorization: 'Bearer tok' } });
	const webReq = koaContextToWeb(ctx as unknown as KoaContext);

	assert.equal(webReq.headers.get('x-tenant'), 'acme');
	assert.equal(webReq.headers.get('authorization'), 'Bearer tok');
});

test('koaContextToWeb: uses rawBody when present', async () => {
	const ctx = makeKoaCtx({ method: 'POST', rawBody: '{"name":"fonderie"}' });
	const webReq = koaContextToWeb(ctx as unknown as KoaContext);
	const body = (await webReq.json()) as any;

	assert.equal(body.name, 'fonderie');
});

test('koaContextToWeb: body is null when rawBody is absent', async () => {
	const ctx = makeKoaCtx({ method: 'POST' });
	const webReq = koaContextToWeb(ctx as unknown as KoaContext);

	assert.equal(webReq.body, null);
});

test('koaContextToWeb: GET with rawBody does not throw (body suppressed)', () => {
	const ctx = makeKoaCtx({ method: 'GET', rawBody: '{"should":"be ignored"}' });
	assert.doesNotThrow(() => koaContextToWeb(ctx as unknown as KoaContext));
});

test('koaContextToWeb: HEAD with rawBody does not throw (body suppressed)', () => {
	const ctx = makeKoaCtx({ method: 'HEAD', rawBody: 'data' });
	assert.doesNotThrow(() => koaContextToWeb(ctx as unknown as KoaContext));
});

// ── webResponseToKoa ──────────────────────────────────────────────

test('webResponseToKoa: writes status, headers, and body', async () => {
	const webRes = new Response(JSON.stringify({ ok: true }), {
		status: 202,
		headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
	});
	const ctx = makeKoaCtx();

	await webResponseToKoa(webRes, ctx as unknown as KoaContext);

	assert.equal(ctx.response.status, 202);
	assert.equal(ctx.response.headers['x-trace'], 'abc');
	assert.equal(ctx.response.body, '{"ok":true}');
});

// ── bridge ────────────────────────────────────────────────────────

test('bridge: sets ctx.state._fonderie', async () => {
	const ctx = makeKoaCtx();
	const mw = bridge(makeApp({ id: 'u1' }));

	let nextCalled = false;
	await mw(ctx as any, async () => {
		nextCalled = true;
	});

	assert.ok(nextCalled);
	assert.ok(ctx.state['_fonderie']);
	assert.equal(((ctx.state['_fonderie'] as any).user as any).id, 'u1');
});

// ── adapt ─────────────────────────────────────────────────────────

test('adapt: calls next() when fonderie middleware continues', async () => {
	const ctx = makeKoaCtx();
	ctx.state['_fonderie'] = makeCtx({ id: 'u1' });

	let nextCalled = false;
	await adapt(async (_fCtx, n) => n())(ctx as any, async () => {
		nextCalled = true;
	});

	assert.ok(nextCalled);
});

test('adapt: writes response to ctx when fonderie middleware short-circuits', async () => {
	const ctx = makeKoaCtx();
	ctx.state['_fonderie'] = makeCtx();

	let nextCalled = false;
	const guard = adapt(async () => Response.json({ blocked: true }, { status: 403 }));
	await guard(ctx as any, async () => {
		nextCalled = true;
	});

	assert.ok(!nextCalled);
	assert.equal(ctx.response.status, 403);
	assert.ok((ctx.response.body as string).includes('blocked'));
});

test('adapt: throws when bridge has not run', async () => {
	const ctx = makeKoaCtx();
	// state._fonderie is NOT set

	await assert.rejects(
		() => adapt(async (_ctx, n) => n())(ctx as any, async () => {}),
		/bridge\(\)/,
	);
});

// ── requireAuth ───────────────────────────────────────────────────

test('requireAuth: 401 when ctx.state._fonderie.user is null', async () => {
	const ctx = makeKoaCtx();
	ctx.state['_fonderie'] = makeCtx(null);

	let nextCalled = false;
	await requireAuth(ctx as any, async () => {
		nextCalled = true;
	});

	assert.ok(!nextCalled);
	assert.equal(ctx.response.status, 401);
});

test('requireAuth: calls next when user is set', async () => {
	const ctx = makeKoaCtx();
	ctx.state['_fonderie'] = makeCtx({ id: 'u1' });

	let nextCalled = false;
	await requireAuth(ctx as any, async () => {
		nextCalled = true;
	});

	assert.ok(nextCalled);
});

// ── mount ─────────────────────────────────────────────────────────

test('mount: returns the same app instance', () => {
	const stub = { use(_fn: unknown) { return stub; } };
	const result = mount(stub as any, makeApp());
	assert.strictEqual(result, stub);
});

test('mount: ctx.state._fonderie is set by the registered middleware', async () => {
	const mw = collectMiddleware(makeApp({ id: 'u1' }));
	const ctx = makeKoaCtx();

	await mw(ctx, async () => {});

	assert.ok(ctx.state['_fonderie']);
	assert.equal(((ctx.state['_fonderie'] as any).user as any).id, 'u1');
});

test('mount: next() is called so user routes run inside the wrap-around', async () => {
	const mw = collectMiddleware(makeApp());
	const ctx = makeKoaCtx();

	let nextCalled = false;
	await mw(ctx, async () => { nextCalled = true; });

	assert.ok(nextCalled);
});

test('mount: user route response is preserved — fonderie infra does not overwrite', async () => {
	const mw = collectMiddleware(makeApp());
	const ctx = makeKoaCtx();

	await mw(ctx, async () => {
		ctx.response.body = '{"mine":true}';   // user route handles request
	});

	assert.equal(ctx.response.body, '{"mine":true}');
});

test('mount: fonderie.handle() called as fallback when no user route responds', async () => {
	const mw = collectMiddleware(makeApp());
	const ctx = makeKoaCtx();

	await mw(ctx, async () => {});             // next() leaves ctx.body undefined

	assert.equal(ctx.response.body, '{"from":"fonderie"}');
});
