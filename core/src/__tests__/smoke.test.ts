import { test } from 'node:test';
import assert   from 'node:assert/strict';

// ── inline the imports (no build step needed yet) ────────────────
import { FonderieApp }          from '../app';
import { defineConfig }         from '../config';
import type { IFonderieModule }   from '../types';
import { bodyParserMiddleware }  from '../middlewares/body-parser';

// ── minimal config — no real DB needed for core tests ───────────
const config = defineConfig({
	db: { url: 'postgres://localhost/test' },
})

// ── helpers ──────────────────────────────────────────────────────
function makeRequest(method: string, path: string, body?: unknown): Request {
	return new Request(`http://localhost${path}`, {
		method,
		body: body ? JSON.stringify(body) : null,
		headers: { 'content-type': 'application/json' },
	});
}

// ── tests ────────────────────────────────────────────────────────

test('returns 404 for unregistered route', async () => {
	const app = await new FonderieApp(config).boot();
	const res = await app.handle(makeRequest('GET', '/unknown'));

	assert.equal(res.status, 404);
})

test('registered route receives request and returns response', async () => {
	const app = new FonderieApp(config);

	app.addRoute('GET', '/health', async (_ctx, _next) =>
		Response.json({ ok: true }, { status: 200 })
	);

	await app.boot();

	const res  = await app.handle(makeRequest('GET', '/health'));
	const body = await res.json() as { ok: boolean }

	assert.equal(res.status, 200);
	assert.equal(body.ok, true);
});

test('module installs its route on boot', async () => {
	const pingModule: IFonderieModule = {
		name: 'ping',
		install(app) {
			app.addRoute('GET', '/ping', async () =>
				Response.json({ pong: true })
			);
		},
	}

	const app = await new FonderieApp(config).register(pingModule).boot();

	const res  = await app.handle(makeRequest('GET', '/ping'));
	const body = await res.json() as { pong: boolean }

	assert.equal(res.status, 200);
	assert.equal(body.pong, true);
});

test('middleware runs in order', async () => {
	const log: string[] = [];

	const app = new FonderieApp(config);

	app.use(async (ctx, next) => {
		log.push('mw1-before');

		const r = await next();
		log.push('mw1-after');

		return r;
	});
	
	app.use(async (ctx, next) => {
		log.push('mw2-before');

		const r = await next();
		log.push('mw2-after');

		return r;
	});

	app.addRoute('GET', '/order', async () => {
		log.push('handler'); 

		return Response.json({ ok: true });
	});

	await app.boot();
	await app.handle(makeRequest('GET', '/order'));

	assert.deepEqual(log, ['mw1-before', 'mw2-before', 'handler', 'mw2-after', 'mw1-after']);
});

test('route params are extracted into ctx.meta.params', async () => {
	const app = new FonderieApp(config);

	app.addRoute('GET', '/users/:id', async (ctx) => {
		const params = ctx.meta['params'] as { id: string }
		return Response.json({ id: params.id });
	});

	await app.boot();

	const res  = await app.handle(makeRequest('GET', '/users/42'));
	const body = await res.json() as { id: string }

	assert.equal(body.id, '42');
});

test('body parser puts parsed json on ctx.meta.body', async () => {
	const app = new FonderieApp(config);

	app.use(bodyParserMiddleware());
	app.addRoute('POST', '/echo', async (ctx) =>
		Response.json(ctx.meta['body'])
	);

	await app.boot();

	const res  = await app.handle(makeRequest('POST', '/echo', { name: 'fonderie' }));
	const body = await res.json() as { name: string }

	assert.equal(body.name, 'fonderie');
});

test('onError config is called on handler throw', async () => {
	const app = new FonderieApp({
		...config,
		onError: () => Response.json({ custom: true }, { status: 500 }),
	});

	app.addRoute('GET', '/boom', async () => { throw new Error('test error') });

	await app.boot();

	const res  = await app.handle(makeRequest('GET', '/boom'));
	const body = await res.json() as { custom: boolean }

	assert.equal(res.status, 500);
	assert.equal(body.custom, true);
});
