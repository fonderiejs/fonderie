import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	bridge,
	adapt,
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
		body: null as unknown,
		status: 200,
		headers: {} as Record<string, string>,
		set(k: string, v: string) {
			this.headers[k] = v;
		},
	};
	return {
		request: {
			method: opts.method ?? 'GET',
			url: opts.url ?? '/',
			headers: { host: 'localhost', ...opts.headers },
			rawBody: opts.rawBody,
		},
		response,
		req: { socket: {} } as any,
		state: {} as Record<string, unknown>,
	};
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
	const ctx = makeKoaCtx({ method: 'GET' });
	const webReq = koaContextToWeb(ctx as unknown as KoaContext);

	assert.equal(webReq.body, null);
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
