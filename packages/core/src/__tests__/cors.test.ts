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
