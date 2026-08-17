import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── inline the imports (no build step needed yet) ────────────────
import { FonderieApp } from '../app';
import { defineConfig } from '../config';
import type { IFonderieModule } from '../types';

// ── minimal config — no real DB needed for core tests ───────────
const config = defineConfig({
	db: { url: 'postgres://localhost/test' },
});

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
});

test('registered route receives request and returns response', async () => {
	const app = new FonderieApp(config);

	app.addRoute('GET', '/health', async (_ctx, _next) =>
		Response.json({ ok: true }, { status: 200 }),
	);

	await app.boot();

	const res = await app.handle(makeRequest('GET', '/health'));
	const body = (await res.json()) as { ok: boolean };

	assert.equal(res.status, 200);
	assert.equal(body.ok, true);
});

// ── security headers (default pipeline) ──────────────────────────

test('security headers: nosniff on every response; no HSTS over http', async () => {
	const app = new FonderieApp(config);
	app.addRoute('GET', '/h', async () => Response.json({ ok: true }));
	await app.boot();
	const res = await app.handle(makeRequest('GET', '/h'));
	assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
	assert.equal(res.headers.get('strict-transport-security'), null); // http request
});

test('security headers: HSTS emitted when the proxy reports https', async () => {
	const app = new FonderieApp(config);
	app.addRoute('GET', '/h', async () => Response.json({ ok: true }));
	await app.boot();
	const req = new Request('http://localhost/h', {
		method: 'GET',
		headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' },
	});
	const res = await app.handle(req);
	assert.match(res.headers.get('strict-transport-security') ?? '', /^max-age=\d+/);
});

// ── onResponse contract-adapter hook ─────────────────────────────

test('onResponse: transforms the body, preserving status', async () => {
	const app = new FonderieApp(defineConfig({
		db: { url: 'postgres://localhost/test' },
		onResponse: (body, { status }) => ({ wrapped: body, status }),
	}));
	app.addRoute('GET', '/x', async () => Response.json({ reason: 'OK', explanation: '', result: { a: 1 } }, { status: 201 }));
	await app.boot();
	const res = await app.handle(makeRequest('GET', '/x'));
	assert.equal(res.status, 201);
	assert.deepEqual(await res.json(), { wrapped: { reason: 'OK', explanation: '', result: { a: 1 } }, status: 201 });
});

test('onResponse: flattens the Fonderie envelope to a client-style shape', async () => {
	// Proves one config option closes the Phase-1 envelope divergence: Fonderie
	// { reason, explanation, result: { tokens, user } } → flat { user, accessToken, refreshToken }.
	const flatten = (body: any, { status }: { status: number }) => {
		if (status >= 400) return { error: body.explanation };
		const r = body.result ?? {};
		if (r.tokens) return { user: r.user, accessToken: r.tokens.access, refreshToken: r.tokens.refresh };
		return r;
	};
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, onResponse: flatten }));
	app.addRoute('POST', '/auth/login', async () =>
		Response.json({ reason: 'LOGGED_IN', explanation: 'ok', result: { tokens: { access: 'AAA', refresh: 'RRR' }, user: { id: 'u1', email: 'a@b.com' } } }, { status: 200 }),
	);
	await app.boot();
	const res = await app.handle(makeRequest('POST', '/auth/login'));
	assert.deepEqual(await res.json(), { user: { id: 'u1', email: 'a@b.com' }, accessToken: 'AAA', refreshToken: 'RRR' });
});

test('onResponse: undefined return leaves the response untouched', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, onResponse: () => undefined }));
	app.addRoute('GET', '/y', async () => Response.json({ reason: 'OK', explanation: '' }, { status: 200 }));
	await app.boot();
	const res = await app.handle(makeRequest('GET', '/y'));
	assert.deepEqual(await res.json(), { reason: 'OK', explanation: '' });
});

test('onResponse: preserves Set-Cookie and skips non-JSON', async () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, onResponse: (b: any) => b.result ?? b }));
	app.addRoute('GET', '/c', async () =>
		Response.json({ reason: 'OK', explanation: '', result: { ok: true } }, { status: 200, headers: { 'set-cookie': 'access_token=AAA; HttpOnly' } }),
	);
	app.addRoute('GET', '/text', async () => new Response('hello', { status: 200, headers: { 'content-type': 'text/plain' } }));
	await app.boot();
	const jsonRes = await app.handle(makeRequest('GET', '/c'));
	assert.equal(jsonRes.headers.get('set-cookie'), 'access_token=AAA; HttpOnly', 'cookie preserved through transform');
	assert.deepEqual(await jsonRes.json(), { ok: true });
	const textRes = await app.handle(makeRequest('GET', '/text'));
	assert.equal(await textRes.text(), 'hello', 'non-JSON passes through untouched');
});

test('listen() returns the server and forwards MULTIPLE Set-Cookie headers', async () => {
	// listen() now returns the http.Server (graceful shutdown + testable). The
	// built-in server had the same forEach+setHeader Set-Cookie bug as the adapters.
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' } }));
	app.addRoute('POST', '/login', async () => {
		const headers = new Headers({ 'content-type': 'application/json' });
		headers.append('set-cookie', 'access_token=A; HttpOnly; Path=/');
		headers.append('set-cookie', 'refresh_token=R; HttpOnly; Path=/auth/refresh');
		return Response.json({ ok: true }, { status: 200, headers });
	});
	await app.boot();
	const server = app.listen(0, { quiet: true });
	await new Promise((r) => (server.listening ? r(undefined) : server.once('listening', r)));
	try {
		const { port } = server.address() as { port: number };
		const res = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
		const cookies = res.headers.getSetCookie();
		assert.equal(cookies.length, 2, 'both cookies arrive over the wire');
		assert.ok(cookies.some((c) => c.startsWith('access_token=A')));
		assert.ok(cookies.some((c) => c.startsWith('refresh_token=R')));
	} finally {
		await new Promise((r) => server.close(() => r(undefined)));
	}
});

test('module installs its route on boot', async () => {
	const pingModule: IFonderieModule = {
		name: 'ping',
		install(app) {
			app.addRoute('GET', '/ping', async () => Response.json({ pong: true }));
		},
	};

	const app = await new FonderieApp(config).register(pingModule).boot();

	const res = await app.handle(makeRequest('GET', '/ping'));
	const body = (await res.json()) as { pong: boolean };

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
		const params = ctx.meta['params'] as { id: string };
		return Response.json({ id: params.id });
	});

	await app.boot();

	const res = await app.handle(makeRequest('GET', '/users/42'));
	const body = (await res.json()) as { id: string };

	assert.equal(body.id, '42');
});

test('body parser puts parsed json on ctx.meta.body', async () => {
	const app = new FonderieApp(config);

	app.addRoute('POST', '/echo', async (ctx) => Response.json(ctx.meta['body']));

	await app.boot();

	const res = await app.handle(makeRequest('POST', '/echo', { name: 'fonderie' }));
	const body = (await res.json()) as { name: string };

	assert.equal(body.name, 'fonderie');
});

test('body parser: active by default — no .use(withBody) required', async () => {
	const app = new FonderieApp(config);

	app.addRoute('POST', '/ping', async (ctx) => Response.json({ got: ctx.meta['body'] }));

	await app.boot();

	const res  = await app.handle(makeRequest('POST', '/ping', { hello: 'world' }));
	const json = (await res.json()) as { got: { hello: string } };

	assert.equal(json.got.hello, 'world');
});

test('body parser: GET requests leave meta.body undefined', async () => {
	const app = new FonderieApp(config);

	app.addRoute('GET', '/check', async (ctx) => Response.json({ body: ctx.meta['body'] ?? null }));

	await app.boot();

	const res  = await app.handle(makeRequest('GET', '/check'));
	const json = (await res.json()) as { body: null };

	assert.equal(json.body, null);
});

test('basePath: prefixed route matches, unprefixed returns 404', async () => {
	const app = new FonderieApp(
		defineConfig({
			basePath: '/v1',
			db: { url: 'postgres://localhost/test' },
		}),
	);

	app.addRoute('GET', '/health', async () => Response.json({ ok: true }));
	await app.boot();

	const hit = await app.handle(makeRequest('GET', '/v1/health'));
	const miss = await app.handle(makeRequest('GET', '/health'));

	assert.equal(hit.status, 200);
	assert.equal(miss.status, 404);
});

test('basePath: params still extracted under prefix', async () => {
	const app = new FonderieApp(
		defineConfig({
			basePath: '/v1',
			db: { url: 'postgres://localhost/test' },
		}),
	);

	app.addRoute('GET', '/users/:id', async (ctx) => {
		const params = ctx.meta['params'] as { id: string };
		return Response.json({ id: params.id });
	});
	await app.boot();

	const res = await app.handle(makeRequest('GET', '/v1/users/99'));
	const body = (await res.json()) as { id: string };

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

	const app = await new FonderieApp(
		defineConfig({
			basePath: '/v1',
			db: { url: 'postgres://localhost/test' },
		}),
	)
		.register(mod)
		.boot();

	const hit = await app.handle(makeRequest('GET', '/v1/ping'));
	const miss = await app.handle(makeRequest('GET', '/ping'));

	assert.equal(hit.status, 200);
	assert.equal(miss.status, 404);
});

test('basePath: defaults to empty — existing routes unaffected', async () => {
	const app = new FonderieApp(
		defineConfig({
			db: { url: 'postgres://localhost/test' },
		}),
	);

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

	app.addRoute('GET', '/boom', async () => {
		throw new Error('test error');
	});

	await app.boot();

	const res = await app.handle(makeRequest('GET', '/boom'));
	const body = (await res.json()) as { custom: boolean };

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
		install() {
			log.push('a');
		},
	};
	const b: IFonderieModule = {
		name: 'b',
		deps: ['a'],
		install() {
			log.push('b');
		},
	};
	const c: IFonderieModule = {
		name: 'c',
		deps: ['b'],
		install() {
			log.push('c');
		},
	};

	// registered in reverse dependency order
	await new FonderieApp(config).register(c).register(b).register(a).boot();

	assert.deepEqual(log, ['a', 'b', 'c']);
});

test('boot: throws when a declared dep is not registered', async () => {
	const m: IFonderieModule = {
		name: 'needs-missing',
		deps: ['@fonderie/does-not-exist'],
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

	await assert.rejects(() => new FonderieApp(config).register(a).register(b).boot(), /circular/i);
});

test('boot: module with no deps installs without error', async () => {
	const m: IFonderieModule = { name: 'standalone', install() {} };
	await assert.doesNotReject(() => new FonderieApp(config).register(m).boot());
});

// ── client-ip resolution + proxy-config detection ────────────────

import { resolveClientIp, checkProxyConfig } from '../middlewares/client-ip';
import { _resetProxyWarning } from '../middlewares/client-ip';

test('resolveClientIp: trustProxy=0 uses the socket, ignoring X-Forwarded-For', () => {
	const ip = resolveClientIp('203.0.113.5', new Headers({ 'x-forwarded-for': '1.2.3.4' }), 0);
	assert.equal(ip, '203.0.113.5', 'spoofed XFF is ignored when no proxy is trusted');
});

test('resolveClientIp: trustProxy=N takes the Nth-from-right XFF entry', () => {
	// client, proxy2, proxy1(trusted) → with 1 trusted hop, client is the last entry
	const ip = resolveClientIp('10.0.0.1', new Headers({ 'x-forwarded-for': 'spoof, 198.51.100.9' }), 1);
	assert.equal(ip, '198.51.100.9');
});

test('resolveClientIp: normalizes IPv4-mapped and strips ports', () => {
	assert.equal(resolveClientIp('::ffff:203.0.113.7', new Headers(), 0), '203.0.113.7');
	assert.equal(resolveClientIp('203.0.113.7:54321', new Headers(), 0), '203.0.113.7');
});

test('checkProxyConfig: warns for private/loopback sockets across all ranges', () => {
	const warnings: string[] = [];
	const orig = console.warn;
	console.warn = (m: string) => void warnings.push(m);
	try {
		for (const socket of ['127.0.0.1', '::1', '10.1.2.3', '192.168.0.5', '169.254.1.1', '172.16.9.9', 'fd00::1']) {
			_resetProxyWarning();
			warnings.length = 0;
			checkProxyConfig(socket, new Headers({ 'x-forwarded-for': '203.0.113.1' }), 0);
			assert.equal(warnings.length, 1, `should warn for private socket ${socket}`);
			assert.match(warnings[0]!, /TRUST_PROXY/);
		}
	} finally {
		console.warn = orig;
	}
});

test('checkProxyConfig: does NOT warn for a public socket', () => {
	const warnings: string[] = [];
	const orig = console.warn;
	console.warn = (m: string) => void warnings.push(m);
	try {
		_resetProxyWarning();
		checkProxyConfig('203.0.113.9', new Headers({ 'x-forwarded-for': '198.51.100.1' }), 0);
		assert.equal(warnings.length, 0, 'a public-IP socket is not a local-proxy misconfig');
	} finally {
		console.warn = orig;
	}
});

// ── checkProductionReadiness ─────────────────────────────────────

test('checkProductionReadiness: aggregates module problems; ok=false on any error', () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' } }));
	app.register({
		name: 'mod-a',
		install() {},
		checkReadiness: () => [{ module: 'mod-a', severity: 'error', message: 'weak secret' }],
	});
	app.register({
		name: 'mod-b',
		install() {},
		checkReadiness: () => [{ module: 'mod-b', severity: 'warning', message: 'no email provider' }],
	});
	app.register({ name: 'mod-c', install() {} }); // opts out — no checkReadiness

	const report = app.checkProductionReadiness();
	assert.equal(report.ok, false); // mod-a error
	assert.equal(report.problems.length, 2);
	assert.deepEqual(
		report.problems.map((p) => p.module).sort(),
		['mod-a', 'mod-b'],
	);
});

test('checkProductionReadiness: ok=true when only warnings (or none)', () => {
	const app = new FonderieApp(defineConfig({ db: { url: 'postgres://x' } }));
	app.register({
		name: 'mod-warn',
		install() {},
		checkReadiness: () => [{ module: 'mod-warn', severity: 'warning', message: 'heads up' }],
	});
	const report = app.checkProductionReadiness();
	assert.equal(report.ok, true);
	assert.equal(report.problems.length, 1);

	const empty = new FonderieApp(defineConfig({ db: { url: 'postgres://x' } }));
	assert.deepEqual(empty.checkProductionReadiness(), { ok: true, problems: [] });
});

// ── B1: health & readiness endpoints ────────────────────────────────────
test('healthz: liveness returns 200 ok', async () => {
	const app = await new FonderieApp(config).boot();
	const res = await app.handle(makeRequest('GET', '/healthz'));
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { status: 'ok' });
});

test('readyz: 200 when readiness ok and probe truthy', async () => {
	const app = await new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, readyProbe: () => true })).boot();
	const res = await app.handle(makeRequest('GET', '/readyz'));
	assert.equal(res.status, 200);
	assert.equal((await res.json() as any).status, 'ready');
});

test('readyz: 503 when the dependency probe fails', async () => {
	const app = await new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, readyProbe: () => false })).boot();
	const res = await app.handle(makeRequest('GET', '/readyz'));
	assert.equal(res.status, 503);
	const body = await res.json() as any;
	assert.equal(body.status, 'not_ready');
	assert.equal(body.dependencies, false);
});

test('health routes: disabled via healthChecks:false', async () => {
	const app = await new FonderieApp(defineConfig({ db: { url: 'postgres://localhost/test' }, healthChecks: false })).boot();
	const res = await app.handle(makeRequest('GET', '/healthz'));
	assert.equal(res.status, 404);
});

// ── A1: fail-closed production boot gate ────────────────────────────────
const insecureModule: IFonderieModule = {
	name: 'test-insecure',
	install() {},
	checkReadiness: () => [{ module: 'test-insecure', severity: 'error' as const, message: 'weak secret' }],
};

test('boot gate: throws in production on an error-severity readiness problem', async () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		const app = new FonderieApp(config).register(insecureModule);
		await assert.rejects(() => app.boot(), /refusing to boot in production.*weak secret/s);
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});

test('boot gate: no-op outside production', async () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'development';
	try {
		await assert.doesNotReject(() => new FonderieApp(config).register(insecureModule).boot());
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});

test('boot gate: skipProductionReadinessGate overrides in production', async () => {
	const prev = process.env['NODE_ENV'];
	process.env['NODE_ENV'] = 'production';
	try {
		const cfg = defineConfig({ db: { url: 'postgres://localhost/test' }, skipProductionReadinessGate: true });
		await assert.doesNotReject(() => new FonderieApp(cfg).register(insecureModule).boot());
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV']; else process.env['NODE_ENV'] = prev;
	}
});
