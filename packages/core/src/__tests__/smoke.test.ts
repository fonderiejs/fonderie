import { test } from 'node:test';
import assert   from 'node:assert/strict';

// ── inline the imports (no build step needed yet) ────────────────
import { FonderieApp }          from '../app';
import { defineConfig }         from '../config';
import type { IFonderieModule }   from '../types';
import { withBody }  from '../middlewares/body-parser';

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

	app.use(withBody);
	app.addRoute('POST', '/echo', async (ctx) =>
		Response.json(ctx.meta['body'])
	);

	await app.boot();

	const res  = await app.handle(makeRequest('POST', '/echo', { name: 'fonderie' }));
	const body = await res.json() as { name: string }

	assert.equal(body.name, 'fonderie');
});

test('basePath: prefixed route matches, unprefixed returns 404', async () => {
	const app = new FonderieApp(defineConfig({
		basePath: '/v1',
		db: { url: 'postgres://localhost/test' },
	}));

	app.addRoute('GET', '/health', async () => Response.json({ ok: true }));
	await app.boot();

	const hit  = await app.handle(makeRequest('GET', '/v1/health'));
	const miss = await app.handle(makeRequest('GET', '/health'));

	assert.equal(hit.status, 200);
	assert.equal(miss.status, 404);
});

test('basePath: params still extracted under prefix', async () => {
	const app = new FonderieApp(defineConfig({
		basePath: '/v1',
		db: { url: 'postgres://localhost/test' },
	}));

	app.addRoute('GET', '/users/:id', async (ctx) => {
		const params = ctx.meta['params'] as { id: string };
		return Response.json({ id: params.id });
	});
	await app.boot();

	const res  = await app.handle(makeRequest('GET', '/v1/users/99'));
	const body = await res.json() as { id: string };

	assert.equal(res.status, 200);
	assert.equal(body.id, '99');
});

test('basePath: module routes are registered under prefix', async () => {
	const mod: IFonderieModule = {
		name: 'test',
		install(app) {
			app.addRoute('GET', '/ping', async () => Response.json({ pong: true }));
		},
	};

	const app = await new FonderieApp(defineConfig({
		basePath: '/v1',
		db: { url: 'postgres://localhost/test' },
	})).register(mod).boot();

	const hit  = await app.handle(makeRequest('GET', '/v1/ping'));
	const miss = await app.handle(makeRequest('GET', '/ping'));

	assert.equal(hit.status, 200);
	assert.equal(miss.status, 404);
});

test('basePath: defaults to empty — existing routes unaffected', async () => {
	const app = new FonderieApp(defineConfig({
		db: { url: 'postgres://localhost/test' },
	}));

	app.addRoute('GET', '/health', async () => Response.json({ ok: true }));
	await app.boot();

	const res = await app.handle(makeRequest('GET', '/health'));
	assert.equal(res.status, 200);
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

test('router: trailing slash on request matches registered path', async () => {
	const app = new FonderieApp(config);
	app.addRoute('GET', '/users', async () => Response.json({ ok: true }));
	await app.boot();

	const res = await app.handle(makeRequest('GET', '/users/'));
	assert.equal(res.status, 200);
});

test('router: root path / still matches after trailing-slash normalisation', async () => {
	const app = new FonderieApp(config);
	app.addRoute('GET', '/', async () => Response.json({ ok: true }));
	await app.boot();

	const res = await app.handle(makeRequest('GET', '/'));
	assert.equal(res.status, 200);
});

// ── module dependency ordering ────────────────────────────────────

test('boot: installs modules in dependency order regardless of registration order', async () => {
	const log: string[] = [];

	const a: IFonderieModule = {
		name: 'a',
		install() { log.push('a'); },
	};
	const b: IFonderieModule = {
		name: 'b',
		deps: ['a'],
		install() { log.push('b'); },
	};
	const c: IFonderieModule = {
		name: 'c',
		deps: ['b'],
		install() { log.push('c'); },
	};

	// registered in reverse dependency order
	await new FonderieApp(config).register(c).register(b).register(a).boot();

	assert.deepEqual(log, ['a', 'b', 'c']);
});

test('boot: throws when a declared dep is not registered', async () => {
	const m: IFonderieModule = {
		name: 'needs-missing',
		deps: ['@fonderie-js/does-not-exist'],
		install() {},
	};

	await assert.rejects(
		() => new FonderieApp(config).register(m).boot(),
		/needs-missing.*does-not-exist/,
	);
});

test('boot: throws on circular dependency', async () => {
	const a: IFonderieModule = { name: 'a', deps: ['b'], install() {} };
	const b: IFonderieModule = { name: 'b', deps: ['a'], install() {} };

	await assert.rejects(
		() => new FonderieApp(config).register(a).register(b).boot(),
		/circular/i,
	);
});

test('boot: module with no deps installs without error', async () => {
	const m: IFonderieModule = { name: 'standalone', install() {} };
	await assert.doesNotReject(() => new FonderieApp(config).register(m).boot());
});
