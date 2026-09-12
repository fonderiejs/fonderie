import { test } from 'node:test';
import assert from 'node:assert/strict';

import { withCors, DEFAULT_CORS_HEADERS, FONDERIE_CLIENT_HEADERS } from '../middlewares/cors';
import type { IFonderieContext } from '../types';

function ctx(method = 'GET', origin?: string): IFonderieContext {
	return {
		request: new Request('http://localhost/v1/thing', {
			method,
			...(origin ? { headers: { origin } } : {}),
		}),
	} as IFonderieContext;
}
const next = async () => new Response('ok', { headers: { 'X-Existing': 'kept' } });

test('withCors: defaults allow every header @fonderie/client sends, and expose the echoed request id', async () => {
	const res = await withCors()(ctx('OPTIONS', 'http://localhost:5173'), next);
	assert.equal(res.status, 204);
	const allow = res.headers.get('Access-Control-Allow-Headers') ?? '';
	for (const h of FONDERIE_CLIENT_HEADERS) {
		assert.ok(allow.includes(h), `${h} must be in the default allow-list`);
	}
	assert.ok(allow.includes('Content-Type') && allow.includes('Authorization'));
	assert.equal(res.headers.get('Access-Control-Expose-Headers'), 'X-Request-ID');
	assert.equal(DEFAULT_CORS_HEADERS.length, 2 + FONDERIE_CLIENT_HEADERS.length);
});

test('withCors: preflight short-circuits — the pipeline never runs', async () => {
	let called = false;
	const trackedNext = async () => {
		called = true;
		return new Response('ok');
	};
	const res = await withCors()(ctx('OPTIONS'), trackedNext);
	assert.equal(res.status, 204);
	assert.equal(called, false);
});

test('withCors: credentials:true requires an explicit origin — * throws at construction', () => {
	assert.throws(() => withCors({ credentials: true }), /origin/);
	assert.throws(() => withCors({ credentials: true, origin: '*' }), /origin/);
	assert.doesNotThrow(() => withCors({ credentials: true, origin: 'http://localhost:5173' }));
	assert.doesNotThrow(() => withCors({ credentials: true, origin: () => true }));
});

test('withCors: credentialed setup emits Allow-Credentials and the concrete origin', async () => {
	const mw = withCors({ credentials: true, origin: 'http://localhost:5173' });
	const res = await mw(ctx('OPTIONS', 'http://localhost:5173'), next);
	assert.equal(res.headers.get('Access-Control-Allow-Credentials'), 'true');
	assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
});

test('withCors: predicate origin reflects allowed origins, omits ACAO for denied ones, and varies', async () => {
	const mw = withCors({ origin: (o) => o === 'http://ok.dev' });
	const allowed = await mw(ctx('OPTIONS', 'http://ok.dev'), next);
	assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'http://ok.dev');
	assert.equal(allowed.headers.get('Vary'), 'Origin');
	const denied = await mw(ctx('OPTIONS', 'http://evil.dev'), next);
	assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('withCors: non-preflight responses get the CORS headers patched on, body and headers preserved', async () => {
	const res = await withCors()(ctx('GET', 'http://localhost:5173'), next);
	assert.equal(await res.text(), 'ok');
	assert.equal(res.headers.get('X-Existing'), 'kept');
	assert.ok(res.headers.get('Access-Control-Allow-Headers')?.includes('X-Request-ID'));
	assert.equal(res.headers.get('Access-Control-Expose-Headers'), 'X-Request-ID');
});

test('withCors: exposeHeaders can be emptied and headers overridden', async () => {
	const mw = withCors({ exposeHeaders: [], headers: ['Content-Type'] });
	const res = await mw(ctx('OPTIONS'), next);
	assert.equal(res.headers.get('Access-Control-Expose-Headers'), null);
	assert.equal(res.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

// ── handle() seeding ────────────────────────────────────────────────
// A Web Standard Request has no socket address, so whatever the adapter
// resolved must be seeded into handle() or it is lost — these lock that in.

import { FonderieApp } from '../app';
import { defineConfig } from '../config';

function appWithEcho() {
	const f = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	f.addRoute('GET', '/whoami', async (c) => Response.json({ ip: c.meta.clientIp ?? null }));
	return f;
}

test('handle(): seeded meta reaches a routed handler (the client IP survives)', async () => {
	const res = await appWithEcho().handle(new Request('http://x/whoami'), {
		meta: { clientIp: '203.0.113.7' },
	});
	assert.deepEqual(await res.json(), { ip: '203.0.113.7' });
});

test('handle(): without a seed the handler sees no IP — the regression this guards', async () => {
	const res = await appWithEcho().handle(new Request('http://x/whoami'));
	assert.deepEqual(await res.json(), { ip: null });
});

test('handle(): the seed is copied, so a request cannot mutate the adapter context', async () => {
	const f = new FonderieApp(defineConfig({ basePath: '', db: { url: 'postgres://unused/test' } }));
	f.addRoute('GET', '/mutate', async (c) => {
		c.meta.clientIp = 'changed-by-handler';
		return new Response('ok');
	});
	const seed = { clientIp: '198.51.100.9' };
	await f.handle(new Request('http://x/mutate'), { meta: seed });
	assert.equal(seed.clientIp, '198.51.100.9', 'adapter-owned meta must be untouched');
});
